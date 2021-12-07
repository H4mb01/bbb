require("dotenv").config()

const cors = require('cors')
const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")

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


//Beispiel für Anfrage, bei der ein user nur das geschickt bekommt, 
//wozu er Berechtigung hat
app.get('/posts', authenticateToken, (req, res) => {
    res.json(posts.filter(post => post.username === req.user.name))
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


/************************/
/** USER AUTHENTICATION */
/********************** */

//Verbindung zur Datenbank

/** derzeit nicht funtional */
const { MongoClient } = require('mongodb');
async function db() {
    const uri = "mongodb+srv://bbbacc:test@cluster0.nnb2r.mongodb.net/myFirstDatabase?retryWrites=true&w=majority";
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect();

        await listDatabases(client)
    } catch(e){
        console.error(e)
    } finally {
        await client.close();
    }

}

async function listDatabases(client) {
    const databasesList = await client.db().admin().listDatabases()
    console.log("Databases:")
    databasesList.databases.forEach(database => console.log(database.name))
}

db().catch(console.error)


const users = []

let refreshTokens = []

async function createListing(client, newListing){
    const result = await client.db("Beobachtungsboegen").collection("users").insertOne(newListing)
    
    console.log(`New listing created with the following id: ${result.insertedId}`)
}

async function addUserToDB(user){
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    try {
        await client.connect()
        await createListing(client, user)
    } catch (e) {
        console.log(e)
    } finally {
        client.close()
    }
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

            //addUserToDB(user)
            res.status(201).send()
        } catch {
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
            const refreshToken = jwt.sign(tokenUser, process.env.REFRESH_TOKEN_SECRET)
            refreshTokens.push(refreshToken)
            res.json({accessToken: accessToken, refreshToken: refreshToken})
            res.status(200).send("Success")
        } else {
            res.status(401).send("Not Allowed")
        }
    } catch (e) {
        console.log(e)
        res.status(500).send()
    }
})

// token refreshen
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
    return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "20m"})
}




app.listen(3000)