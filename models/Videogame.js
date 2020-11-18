const mongoose = require('mongoose')
const Schema = mongoose.Schema

const videogameSchema = new Schema ({
    name: {type: String, required: true},
    developer: {type: String},
    platform: {type: [String]},
    genre: {type: [String]},
    releaseDate: {type: Date},
    rating: {type: Number},
    pegi: {type: String},
    imageUrl: {type: String}
})

const Videogame = mongoose.model('Videogame', videogameSchema)

module.exports = Videogame;