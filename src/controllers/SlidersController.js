const Slider = require("../models/Sliders");

module.exports.createSlider = async (req, res) => {
    try {
        let slider = new Slider({
            image: req.file.path,
            restaurant_id: req.body.restaurant_id
        })

        slider.save()
            .then(response => {
                return res.status(200).json({
                    message: "Slider is created"
                })
            })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.getSlider = async (req, res) => {
    try {
        Slider.find().then(slider => {
            return res.status(200).json({
                slider: slider
            })
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}

module.exports.deleteSlider = async (req, res) => {
    try {
        Slider.findByIdAndDelete(req.params.id).then(slider => {
            return res.status(200).json({
                message: "Slider is deleted"
            })
        })
    } catch (error) {
        console.log(error)
        return res.json({
            message: "Error"
        })
    }
}