require("dotenv").config()

const cors = require('cors')
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")

const port = process.env.PORT || 80

const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb')
const uri = "mongodb+srv://bbbacc:test@cluster0.nnb2r.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";

app.use(cors())
app.use(express.json())


const posts = [
    {
        username: "laui",
        title: "post 1"
    },
    {
        username: "tim",
        title: "post 2"
    }
]


// Daten eines Kindes bekommen
app.get("/child/:id", authenticateToken, async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect()
        const child = await findOneChildById(client, req.params.id, req.user.name)
        res.json(child)
    } catch (error) {
        console.log(error)
    } finally {
        await client.close()
    }
})
async function findOneChildById(client, idOfChild, username) {
    const result = await client.db("Beobachtungsboegen").collection("children").findOne({ _id: new ObjectId(idOfChild), creator: username});
    if (result) {
        console.log(`Found a listing in the collection with the id '${idOfChild}':`);
        return result;
    } else {
        console.log(`No listings found with the id '${idOfChild}'`);
    }
}

// Daten aller Kinder bekommen
app.get("/children", authenticateToken, async (req, res) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try{
        await client.connect()
        
        const children = await findAllChilds(client, req.user.name)
        res.json(children)
    } catch (e) {
        console.log(e)
        res.sendStatus(500)
    } finally {
        await client.close()
    }
})
async function findAllChilds(client, username) {
    const result = await client.db("Beobachtungsboegen").collection("children").find({"creator": username});
    if (result) {
        return await result.toArray();
    } else {
        console.log(`No children found of ${username}'`);
    }
}



// neues Kind anlegen
app.post("/create-child", authenticateToken, async (req, res) => {
    const child = {
        creator: req.user.name,
        read: [req.user.name],
        write: [req.user.name],
        firstName: req.body.firstName,
        lastName: req.body.lastName,
        birthDate: req.body.birthDate
    }
    try {
        await createChild(child)
        res.sendStatus(201)
    } catch {
        res.sendStatus(500)
    }
})
async function createChild(child) {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();

        await createListing(client, "children", child)
    } catch(e){
        console.error(e)
    } finally {
        await client.close();
    }
}




// Beobachtung updaten 
app.post("/observation/:id", authenticateToken, async (req, res) => {
    const obs = req.body.observations
    try {
        await updateObservation(obs, req.params.id)
        res.sendStatus(200)
    } catch {
        res.sendStatus(500)
    }
})
async function updateObservation(observation, id){
    const client = new MongoClient(uri, {useNewUrlParser: true, useUnifiedTopology: true })
    try {
        await client.connect()
        await updateListingById(client, id, {observations: observation})
    } catch(e) {
        console.log(e)
    } finally {
        await client.close()
    }
}
async function updateListingById(client, id, updatedListing) {
    const result = await client.db("Beobachtungsboegen").collection("children").updateOne({ _id: new ObjectId(id) }, { $set: updatedListing });
    console.log(`${result.matchedCount} document(s) matched the query criteria.`);
    console.log(`${result.modifiedCount} document(s) was/were updated.`);
}








/************************/
/** USER AUTHENTICATION */
/************************/

app.get("/auth", authenticateToken, (req, res) => {
    res.status(200).json({auth: true})
})

//authentifizieren
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1]
    if (token == null) return res.sendStatus(401)

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        req.user = user
        next()
    })
}

//Beispiel f??r Anfrage, bei der ein user nur das geschickt bekommt, 
//wozu er Berechtigung hat
app.get('/posts', authenticateToken, (req, res) => {
    res.json(posts.filter(post => post.username === req.user.name))
})


//Verbindung zur Datenbank
async function db() {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();

        await readAllUsersFromDB(client)
    } catch(e){
        console.error(e)
    } finally {
        await client.close();
    }
}



db().catch(console.error)


let users = []

let refreshTokens = []

async function createListing(client, collection, newListing){
    const result = await client.db("Beobachtungsboegen").collection(collection).insertOne(newListing)
    
    console.log(`New listing created with the following id: ${result.insertedId}`)
}

async function addUserToDB(user){
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect()
        await createListing(client, "users", user)
    } catch (e) {
        console.log(e)
    } finally {
        client.close()
    }
}

async function readAllUsersFromDB(client) {
    const result = await client.db("Beobachtungsboegen").collection("users").find({})

    const results = await result.toArray()
    users = results
}

// Neuen User anlegen
app.post('/register', async (req, res) => {
    if (users.find(user=>user.name === req.body.name)){
        res.status(401).send("User already exists")
    } else {
        try {
            const salt = await bcrypt.genSalt()
            const hashedPassword = await bcrypt.hash(req.body.password, salt)
            const user = {name: req.body.name, password: hashedPassword}
            users.push(user)

            addUserToDB(user)
            res.status(201).send()
        } catch (e) {
            console.log(e)
            res.status(500).send()
        }
    }    
})

// ausloggen
app.delete("/logout", (req, res) => {
    refreshTokens =  refreshTokens.filter(token => token !== req.body.token)
    res.sendStatus(204)
})

// einloggen
app.post('/users/login', async (req, res) => {
    const user = users.find(user => user.name === req.body.name)
    if(!user) {
        return res.status(400).send("Cannot find user")
    }
    try {
        if (await bcrypt.compare(req.body.password, user.password)) {
            const tokenUser = {name: req.body.name}
            const accessToken = generateAccessToken(tokenUser) 
            const refreshToken = jwt.sign(tokenUser, process.env.REFRESH_TOKEN_SECRET, {expiresIn: "5m"})
            refreshTokens.push(refreshToken)
            res.status(200).json({accessToken: accessToken, refreshToken: refreshToken})
        } else {
            res.status(401).send("Not Allowed")
        }
    } catch (e) {
        console.log(e)
        res.status(500).send()
    }
})

// token refreshen (bekommt refreshToken, sendet neuen accessToken)
app.post("/token", (req, res) => {
    const refreshToken = req.body.token
    if (refreshToken == null) return refreshTokens.sendStatus(401)
    if(!refreshTokens.includes(refreshToken)) return res.sendStatus(403)
    jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET, (err, user) => {
        if (err) return res.sendStatus(403)
        const accessToken = generateAccessToken({name: user.name})
        res.json({accessToken: accessToken})
    } )
})

function generateAccessToken(user) {
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "20s"})
}




app.listen(port)