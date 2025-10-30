const System = require("../models/System")

module.exports.createSystem = async (req, res) => {
    try {
        const body = req.body;

        let system = new System({
            is_uploaded: body.is_uploaded
        })


        system.save()
            .then(response => {
                return res.status(200).json({
                    message: "System is created",
                    response: response
                })
            })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.viewSystem = (req, res, next) => {
    try {
        System.findById("68c5e74a31c70925aae5555d").then(response => {
            return res.status(200).json({ response: response })
        })
    } catch (error) {
        console.log(error.message)
        return res.json({
            message: "Error"
        })
    }
}