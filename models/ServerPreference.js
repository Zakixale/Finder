import mongoose from 'mongoose'

const serverPreferenceSchema = new mongoose.Schema({
    serverId : {
        type: String,
        required: true,
        unique: true
    },
    matchChannelId: {
        type: String
    },
    profileChannelId: {
        type: String
    }
}, {timestamps: {createDate: 'created_at', updatedDated: 'updated_at'}})

const ServerPreference = mongoose.model('ServerPreference', serverPreferenceSchema)

export default ServerPreference