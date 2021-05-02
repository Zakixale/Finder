import mongoose from 'mongoose'

const likeSchema = new mongoose.Schema({
    sender: {
        type: String,
        required: true
    },
    target: {
        type: String,
        required: true
    },
    server: {
        type: String,
        required: true
    }
}, {timestamps: {createDate: 'created_at', updatedDated: 'updated_at'}})

const Like = mongoose.model('Like', likeSchema)

export default Like