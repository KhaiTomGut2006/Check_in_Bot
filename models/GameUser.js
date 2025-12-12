const mongoose = require('mongoose');
const { Schema } = mongoose;
const { RANK_TIERS, BADGE_RANKS, TICKET_STATUS, MAIN_QUEST_STATUS, BADGE_TYPES, SUB_QUEST_STATUS } = require('./constants');
const { DiscordRoleSchema } = require('./SharedSchemas');

const InventoryItemSchema = new Schema({
    kind: {
        type: String,
        required: true,
        enum: ['Normal', 'Stackable', 'Ticket']
    },
    itemId: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
    acquiredAt: { type: Date, default: Date.now }
}, {
    discriminatorKey: 'kind',
    _id: true
});

const StackableInventoryItemSchema = new Schema({
    quantity: { type: Number, default: 1, min: 0 }
}, { _id: false });

const TicketInventoryItemSchema = new Schema({
    instanceId: { type: String, required: true },
    status: { type: String, enum: TICKET_STATUS, default: 'Unused' },
    expiresAt: Date
}, { _id: false });

const NormalInventoryItemSchema = new Schema({}, { _id: false });

const QuestCompletionSchema = new Schema({
    questId: { type: Schema.Types.ObjectId, ref: 'Quest' },
    subQuestsProgress: [{
        subQuestId: { type: Schema.Types.ObjectId },
        status: { type: String, enum: SUB_QUEST_STATUS, default: 'Active' },
        submissionId: { type: Schema.Types.ObjectId, ref: 'Submission' },
        rewardsClaimed: { type: Boolean, default: false }
    }],
    isCompleted: { type: Boolean, default: false },
    status: { type: String, enum: MAIN_QUEST_STATUS, default: 'Active' },
    acceptedAt: { type: Date, default: Date.now }
}, { _id: false });

const UserSchema = new Schema({
    username: { type: String, required: true, unique: true, index: true },
    discordId: { type: String, required: true, index: true },
    avatar: { type: String },
    id: { type: String }, 
    code: { type: String },
    mobile: { type: String },
    fullname: { type: String },
    nick: { type: String },
    line: { type: String },
    age: { type: String },
    isAdmin: { type: Boolean, default: false },
    roles: [DiscordRoleSchema],
    rank: {
        currentTier: { type: String, enum: RANK_TIERS, default: 'Meteor I' },
        points: { type: Number, default: 0 }
    },
    badges: {
        type: Map,
        of: new Schema({
            rank: { type: String, enum: BADGE_RANKS, default: 'Unranked' },
            points: { type: Number, default: 0 }
        }, { _id: false })
    },
    coins: { type: Number, default: 0 },
    leaderboardScore: { type: Number, default: 0 },
    inventory: [InventoryItemSchema],
    activeQuests: [QuestCompletionSchema],
    completedQuests: [QuestCompletionSchema],
    joinedDojos: [{ type: Schema.Types.ObjectId, ref: 'Dojo' }],
    dailyShop: [
        {
            item: { type: Schema.Types.ObjectId, ref: 'Item', required: true },
            price: { type: Number, required: true },
            stock: { type: Number, required: true }
        }
    ]
}, { timestamps: true });

UserSchema.path('inventory').discriminator('Normal', NormalInventoryItemSchema);
UserSchema.path('inventory').discriminator('Stackable', StackableInventoryItemSchema);
UserSchema.path('inventory').discriminator('Ticket', TicketInventoryItemSchema);

UserSchema.pre('save', async function () {
    if (this.isNew && (!this.badges || this.badges.size === 0)) {
        this.badges = new Map();
        BADGE_TYPES.forEach(type => {
            this.badges.set(type, { rank: 'Unranked', points: 0 });
        });
    }
});

UserSchema.methods.getMaxBadgePoints = function (badgeType) {
    return 1000 * ((BADGE_RANKS.indexOf(this.badges.get(badgeType).rank) + 1) * 2);
};

UserSchema.methods.getMaxRankPoints = function () {
    return 200 * (RANK_TIERS.indexOf(this.rank.currentTier) + 1);
};

UserSchema.methods.findItem = function (targetItemId) {
    return this.inventory.find(i => i.itemId.toString() === targetItemId.toString());
};

const gameConnection = mongoose.createConnection(process.env.GAME_URI);
const User = gameConnection.model('User', UserSchema);

module.exports = { User };