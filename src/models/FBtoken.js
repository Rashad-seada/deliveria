const mongoose = require('mongoose')
const Schema = mongoose.Schema

const FBscheema = new Schema({
    id: String,
    FBtoken: String,
}, { timestamps: true })

FBscheema.statics.userHasToken = async function (id) {
    if (!id) throw new Error('Invalid id')
    try {
        const token = await this.findOne({ id: id })
        if (token) return true
        return false
    } catch (error) {
        console.log(error.message)
        return true
    }
}

FBscheema.statics.userTokenMatches = async function (id, FBtoken) {
    if (!id) throw new Error('Invalid id')
    try {
        const token = await this.findOne({ id: id, FBtoken: FBtoken })
        if (token) return true
        return false
    } catch (error) {
        console.log(error.message)
        return false
    }
}
const FBtoken = mongoose.model('FBtoken', FBscheema)
module.exports = FBtoken