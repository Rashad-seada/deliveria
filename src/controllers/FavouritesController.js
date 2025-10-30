const Favourite = require("../models/Favourites");

module.exports.getFavourite = async (req, res, next) => {
    try {
        const favourite = await Favourite.findOne({ user_id: req.body.decoded.id }).populate("favourites")
        const favouriteId = await Favourite.findOne({ user_id: req.body.decoded.id })

        if (!favourite) {
            return res.json({
                message: "No favourites"
            })
        } else {
            return res.json({
                message: "Done",
                response: favourite,
                ids: favouriteId.favourites
            })
        }
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.addFavourite = async (req, res) => {
    try {
        const favourite = await Favourite.findOne({ user_id: req.body.decoded.id })

        if (!favourite) {
            let addFavourite = new Favourite({
                user_id: req.body.decoded.id,
                favourites: [req.params.id]
            })

            addFavourite.save()
                .then(response => {
                    return res.status(200).json({
                        message: "Added to favourites",
                        favourite: req.params.id
                    })
                })
        } else {
            if (!favourite.favourites.includes(req.params.id)) {
                favourite.favourites.push(req.params.id);
                await favourite.save();

                return res.status(200).json({
                    message: "Added to favourites",
                    favourite: req.params.id
                });
            } else {
                return res.status(200).json({
                    message: "Already in favourites",
                    favourite: req.params.id
                });
            }
        }
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}

module.exports.removeFavourite = async (req, res) => {
    try {
        const favourite = await Favourite.findOne({ user_id: req.body.decoded.id })

        if (favourite.favourites.includes(req.params.id)) {
            favourite.favourites.pull(req.params.id);
            await favourite.save();

            return res.status(200).json({
                message: "Removed from favourites",
                favourite: req.params.id
            });
        } else {
            return res.status(200).json({
                message: "Unit is not in favourites",
                favourite: req.params.id
            });
        }
    } catch (error) {
        return res.json({
            message: "Error"
        })
    }
}