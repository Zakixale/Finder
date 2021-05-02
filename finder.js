import dotenv from 'dotenv'
import Discord from 'discord.js'
import mongoose from 'mongoose'
import AutoIncrementFactory from 'mongoose-sequence'

import ServerPreference from './models/ServerPreference.js'
import Profile from './models/profile.js'
import Like from './models/like.js'

dotenv.config()

const client = new Discord.Client()
const prefix = 'fd!'

const connection = mongoose.connect(process.env.MONGO_CONNECTION_STRING, {useNewUrlParser: true, useFindAndModify: false})
const AutoIncrement = AutoIncrementFactory(connection)

client.once('ready', async () => {
    // Caching olders messages on every servers

    const serversPreferences = await ServerPreference.find({}, 'serverId profileChannelId').lean()

    if(serversPreferences.length === 0){
        console.log(`Les préférences du serveur n'ont pas été mises en place. Finder peut rencontrer des problèmes.`)
        return
    }

    for(let i = 0; i < serversPreferences.length; i++){
        const guild = await client.guilds.fetch(serversPreferences[i].serverId);
        const channel = guild.channels.cache.get(serversPreferences[i].profileChannelId);

        const profiles = await Profile.find({server: serversPreferences[i].serverId}).lean()

        for(let i = 0; i < profiles.length; i++){
            await channel.messages.fetch(profiles[i].id)
        }
    }
})

client.on('message', async (message) => {
    if(message.author.bot) return
    if (!message.content.startsWith(prefix)) return

    let commandBody = message.content.slice(prefix.length)
    let args = commandBody.split(' ')
    let command = args.shift().toLowerCase()
    let commandContent = message.content.match(/(?:"[^"]*"|^[^"]*$)/)[0].replace(/"/g, "")

    switch (command) {
        case 'create-profile':
            // The description is in commandContent
            if(commandContent.length < 50 || commandContent.length > 2000){
                message.reply(`Ta description doit contenir au minimum 50 caractères et 2000 au maximum !`)
                return
            }

            const alreadyHaveProfileCP = await Profile.find({user: message.author.id, server: message.guild.id}, 'id').lean()

            if(alreadyHaveProfileCP.length !== 0){
                message.reply(`Tu as déjà créé ton profile !`)
                return
            }

            const profileChannelExistCP = await ServerPreference.findOne({serverId: message.guild.id}, 'profileChannelId').lean()

            if(profileChannelExistCP.length === 0){
                message.reply(`Une erreur de configuration s'est produite (Pas de profile channel).`)
                return
            }

            const profileChannelCP = client.channels.cache.get(profileChannelExistCP.profileChannelId)

            let lastMessageIDCPQuery = await Profile.findOne({server: message.guild.id}, 'createdAt id').sort({createdAt: 'desc'}).lean().exec()
            let lastMessageIDCP = 0

            if(lastMessageIDCPQuery === null){
                lastMessageIDCP = 1
            }
            else{
                lastMessageIDCP = lastMessageIDCPQuery.id + 1
            }

            const profileEmbed = new Discord.MessageEmbed()
               .setColor('#d61c1c')
                .setTitle(`Profile n'°${lastMessageIDCP}`)
                .setDescription(commandContent)
                .addFields(
                    {name: 'ID', value: lastMessageIDCP, inline: true}
                )
                .setTimestamp()

            profileChannelCP.send(profileEmbed).then(async (newMessage) => {
                // Save it to the db
                const newProfile = new Profile({description: commandContent, user: message.author.id, server: message.guild.id, messageId: newMessage.id})
                const saveProfileCP = await newProfile.save()
                newMessage.react('♥️')
                message.reply(`Ton profil a été créé avec succès !`)
            }).catch((err) => {
                message.reply(`Une erreur s'est produite`)
                console.error(err.message)
            })

            break

        case 'modify-profile':
            if(commandContent.length < 50 || commandContent.length > 2000){
                message.reply(`Ta description doit contenir au minimum 50 caractères et 2000 au maximum !`)
                return
            }

            const alreadyHaveProfileMP = await Profile.find({user: message.author.id, server: message.guild.id}, 'id')
            if(alreadyHaveProfileMP.length === 0){
                message.reply(`Tu n'as pas encore créé ton profile !`)
                return
            }

            const profileChannelExistMP = await ServerPreference.findOne({serverId: message.guild.id}, 'profileChannelId').lean()

            if(profileChannelExistMP.length === 0){
                message.reply(`Une erreur de configuration s'est produite (Pas de profile channel).`)
                return
            }

            // Delete previous message
            const previousMessageId = await Profile.findOne({user: message.author.id, server: message.guild.id}, 'messageId').lean()
            client.channels.cache.get(profileChannelExistMP.profileChannelId).messages.fetch(previousMessageId.messageId).then(message => message.delete())
            //

            const profileChannelMP = client.channels.cache.get(profileChannelExistMP.profileChannelId)

            let lastMessageIDMPQuery = await Profile.findOne({server: message.guild.id}, 'createdAt id').sort({createdAt: 'desc'}).lean().exec()
            let lastMessageIDMP = 0

            if(lastMessageIDMPQuery === null){
                lastMessageIDMP = 1
            }
            else{
                lastMessageIDMP = lastMessageIDMPQuery.id
            }

            const modifyProfileEmbed = new Discord.MessageEmbed()
                .setColor('#d61c1c')
                .setTitle(`Profile n'°${lastMessageIDMP}`)
                .setDescription(commandContent)
                .addFields(
                    {name: 'ID', value: lastMessageIDMP, inline: true}
                )
                .setTimestamp()

            profileChannelMP.send(modifyProfileEmbed).then(async (newMessage) => {
                // Save it to the db
                const saveProfileMP = await Profile.findOneAndUpdate({user: message.author.id, server: message.guild.id}, {description: commandContent, messageId: newMessage.id})
                newMessage.react('♥️')
                message.reply(`Ton profil a été modifié avec succès !`)
            }).catch((err) => {
                message.reply(`Une erreur s'est produite`)
                console.error(err.message)
            })

            break

        case 'set-profile-channel':
            if(!message.member.hasPermission("ADMINISTRATOR")){
                return
            }

            const isAlreadyConfigSPC = await ServerPreference.find({serverId: message.guild.id}, 'serverId').lean()

            if(isAlreadyConfigSPC.length === 0){
                const newConfig = new ServerPreference({serverId: message.guild.id, profileChannelId: message.channel.id}).lean()
                const saveConfig = await newConfig.save()

                message.reply(`Le channel dédié aux profils a bien été défini !`)
            }
            else{
                const updateConfig = await ServerPreference.findOneAndUpdate({serverId: message.guild.id}, {profileChannelId: message.channel.id}).lean()
                message.reply(`Le channel dédié aux profils a bien été mis à jour !`)
            }
            break

        case 'set-match-channel':
            if(!message.member.hasPermission("ADMINISTRATOR")){
                console.log('pas admin')
                return
            }

            const isAlreadyConfigSMC = await ServerPreference.find({serverId: message.guild.id}, 'serverId').lean()

            if(isAlreadyConfigSMC.length === 0){
                const newConfig = new ServerPreference({serverId: message.guild.id, matchChannelId: message.channel.id}).lean()
                const saveConfig = await newConfig.save()

                message.reply(`Le channel dédié aux matchs a bien été défini !`)
            }
            else{
                const updateConfig = await ServerPreference.findOneAndUpdate({serverId: message.guild.id}, {matchChannelId: message.channel.id}).lean()
                message.reply(`Le channel dédié aux matchs a bien été mis à jour !`)
            }
            break

        case 'delete-profile':
            if(args.length !== 0){
                if(!message.member.hasPermission("ADMINISTRATOR")) return

                const targetAsProfile = await Profile.find({id: args[0], server: message.guild.id}).lean()
                if(targetAsProfile.length === 0){
                    message.reply(`Impossible de récupérer le profile ayant l'id ${args[0]}`)
                    return
                }

                // Delete the message from the profile channel
                const profileChannelId = await ServerPreference.findOne({serverId: message.guild.id}, 'profileChannelId').lean()
                const previousMessageIdDel = await Profile.findOne({id: args[0], server: message.guild.id}, 'messageId').lean()

                client.channels.cache.get(profileChannelId.profileChannelId).messages
                    .fetch(previousMessageIdDel.messageId)
                    .then(async (oldMessage) => {
                        if(oldMessage !== null){
                            const deleteProfile = await Profile.deleteOne({user: message.author.id, server: message.guild.id}).lean()
                            oldMessage.delete()
                            message.reply(`Le profile bien été supprimé !`)
                        }
                    })
                    .catch(async (err) => {
                        const deleteProfile = await Profile.deleteOne({user: message.author.id, server: message.guild.id}).lean()
                        message.reply(`Le profile bien été supprimé !`)
                        console.log(`Une erreur s'est produite, il est possible que l'ancien message ait été supprimé : ${err}`)
                    })
            }
            else{
                const asProfile = await Profile.find({user: message.author.id, server: message.guild.id} ,'id').lean()
                if(asProfile.length === 0){
                    message.reply(`Tu n'as pas encore créé ton profile !`)
                    return
                }

                // Delete the message from the profile channel
                const profileChannelId = await ServerPreference.findOne({serverId: message.guild.id}, 'profileChannelId').lean()
                const previousMessageIdDel = await Profile.findOne({user: message.author.id, server: message.guild.id}, 'messageId').lean()
                client.channels.cache.get(profileChannelId.profileChannelId).messages
                    .fetch(previousMessageIdDel.messageId)
                    .then(async (oldMessage) => {
                        if(oldMessage !== null){
                            const deleteProfile = await Profile.deleteOne({user: message.author.id, server: message.guild.id}).lean()
                            oldMessage.delete()
                            message.reply(`Ton profile bien été supprimé !`)
                        }
                    })
                    .catch(async (err) => {
                        const deleteProfile = await Profile.deleteOne({user: message.author.id, server: message.guild.id}).lean()
                        message.reply(`Ton profile bien été supprimé !`)
                        console.log(`Une erreur s'est produite, il est possible que l'ancien message ait été supprimé : ${err}`)
                    })
            }

            break

        case 'help':
            const helpEmbed = {
                'title': 'Voici la liste des commandes disponibles :',
                'description': `prefix : **fd!**\n\n- **help**    \n*(Envoie un message discord disposant de toutes les commandes disponibles ainsi que leurs informations)*\n\n- **create-profile**\n*(Vous permet de créer votre profile ex : fd!create-profile "J'ai 25 ans et j'aime les pizzas aux ananas")*\n\n- **modify-profile**\n *(Vous permet de modifier votre profil après qu'il ait été posté ex : fd!modify-profile "J'ai 18 ans et j'aime les pizzas aux anchois")*\n\n- **delete-profile**\n*(Supprime votre profile ainsi que tous les likes qui y ont été assignés)*\n\n- **set-profile-channel** (admin)\n*(Permet aux administrateurs de définir le canal où les profils seront postés)*\n\n- **set-match-channel** (admin)\n*(Permet aux administrateurs de définir le canal où les matchs seront annoncé)*\n\n- **admin-delete-profile** (admin) \n*(Permet aux administrateurs de supprimer le profil d'un utilisateur)*\n\n\nBot développé par <@213286259580207104> avec les idées du staff de Talk & Meet (https://discord.gg/ERhBC7SgGA)`,
                'color': 13569869,
                'author': {
                    'name': 'Aides aux commandes Finder'
                },
                'footer': {
                    'text': 'Support : zakixale@gmail.com'
                }
            }
            
            message.reply({embed: helpEmbed})
            break

        default:
    }

})

client.on('messageReactionAdd', async (reaction, user) => {
    if(user.bot) return
    if(reaction._emoji.name !== '♥️')  return

    const messageId = reaction.message.id
    const serverId = reaction.message.guild.id
    const userId = user.id
    const getMessageFromDb = await Profile.findOne({messageId: messageId, server: serverId}).lean()

    if(getMessageFromDb.length === 0){
        console.log('The message doesnt exist in the DB')
        reaction.users.remove(userId)
        return
    }

    if(userId === getMessageFromDb.user){
        console.log('User tried to like himself')
        reaction.users.remove(userId)
        return
    }

    const alreadyLiked = await Like.findOne({sender: userId, target:getMessageFromDb.user, server: serverId})

    if(alreadyLiked !== null){
        console.log('User tried to like multiple times')
        reaction.users.remove(userId)
        return
    }

    const like = new Like({sender: userId, target: getMessageFromDb.user, server: serverId})
    const savedLike = await like.save()

    reaction.users.remove(userId)

    // Test if there is a match
    const testMatchOne = await Like.findOne({sender: getMessageFromDb.user, target: userId})
    const testMatchTwo = await Like.findOne({sender: userId, target: getMessageFromDb.user})

    // No match
    if(testMatchOne === null || testMatchTwo === null){
        console.log('pas match')
        return
    }

    // Match
    // Get the match channel from this server
    const matchChannel = await ServerPreference.findOne({serverId: serverId}, 'matchChannelId')

    if(matchChannel === null){
        console.log('Match channel unknown, the bot may crash.')
        return
    }

    const matchChannelCache = client.channels.cache.get(matchChannel.matchChannelId)
    const getUserOne = client.users.cache.find(user => user.id === getMessageFromDb.user)
    const getUserTwo = client.users.cache.find(user => user.id === userId)

    const matchEmbed = new Discord.MessageEmbed()
        .setColor('#d61c1c')
        .setTitle(`Nouveau match !`)
        .setDescription(`Nouveau match ! ${getUserOne} & ${getUserTwo} ! Vous pouvez vous contacter dès à présent ! Ne vous faites pas désirer plus longtemps ;) !`)
        .addFields(
            {name: 'Personne n°1', value: `${getUserOne}`, inline: true},
                 {name: 'Personne n°2', value: `${getUserTwo}`, inline: true}
        )
        .setTimestamp()

    matchChannelCache.send(matchEmbed).then(async (newMessage) => {
        matchChannelCache.send(`${getUserOne} & ${getUserTwo}`).then(async (newMsg) => {
        }).catch((err) => {
            console.error(err.message)
        })
    }).catch((err) => {
        console.error(err.message)
    })

})

client.login(process.env.TOKEN)