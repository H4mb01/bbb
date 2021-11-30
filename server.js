require("dotenv").config()

const express = require('express')
const app = express()
const bcrypt = require('bcrypt')
const jwt = require("jsonwebtoken")

app.use(express.json())

const users = [ {
    name: "tim",
    password: "kp"
}]

//Beispiel-request (später löschen)
app.get('/users', authenticateToken, (req, res) => {
    res.json(users)
})

// Neuen User anlegen
app.post('/users', async (req, res) => {
    if (users.find(user=>user.name === req.body.name)){
        res.status(401).send("User already exists")
    } else {
        try {
            const salt = await bcrypt.genSalt()
            const hashedPassword = await bcrypt.hash(req.body.password, salt)
            const user = {name: req.body.name, password: hashedPassword}
            users.push(user)
            res.status(201).send()
        } catch {
            res.status(500).send()
        }
    }    
})

// einloggen
app.post('/users/login', async (req, res) => {
    const user = users.find(user => user.name === req.body.name)
    if(user === null) {
        return res.status(400).send("Cannot find user")
    }
    try {
        if (await bcrypt.compare(req.body.password, user.password)) {
            const tokenUser = {name: req.body.name}
            const accessToken = jwt.sign(tokenUser, process.env.ACCESS_TOKEN_SECRET)
            res.json({accessToken: accessToken})
            res.status(200).send("Success")
        } else {
            res.status(401).send("Not Allowed")
        }
    } catch {
        res.status(500).send()
    }
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

app.listen(3000)