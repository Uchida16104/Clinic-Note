import express from 'express'
import cors from 'cors'
import { basicAuth } from './auth.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', basicAuth, (req, res) => {
  res.json({ status: 'ok', user: req.user })
})

const PORT = process.env.PORT || 3000
app.listen(PORT)
