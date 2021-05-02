import mongoose from 'mongoose'
import AutoIncrementFactory from 'mongoose-sequence'

const profileSchema = new mongoose.Schema({
    description: {
        type: String,
        required: true
    },
    user: {
        type: String,
        required: true
    },
    server: {
        type: String,
        required: true
    },
    messageId: {
        type: String,
        required: true
    }
}, {timestamps: {createDate: 'created_at', updatedDated: 'updated_at'}})

const AutoIncrement = AutoIncrementFactory(mongoose)

profileSchema.plugin(AutoIncrement, {inc_field: 'id'})

const Profile = mongoose.model('Profile', profileSchema)

export default Profile