// models/constants.js

const CONSTANTS = {
    ITEM_TYPES: ['UpgradeStone', 'Ticket', 'Other'],
    TICKET_STATUS: ['Unused', 'Used', 'Approving', 'Expired'],
    BADGE_TYPES: ['GameDesign', 'LevelDesign', 'Art', 'Programming'],
    BADGE_RANKS: ['Unranked', 'Bronze', 'Silver', 'Gold', 'Diamond'],
    RANK_TIERS: [
        'Meteor I', 'Meteor II', 'Meteor III',
        'Planet I', 'Planet II', 'Planet III',
        'Star I', 'Star II', 'Star III',
        'Supernova', 'Cosmic'
    ],
    QUEST_STATUS: ['NotStarted', 'InProgress', 'PendingApproval', 'Completed'],
    QUEST_TYPES: ['Main', 'Special'],
    MAIN_QUEST_STATUS: ['Active', 'Pending', 'Completed', 'Rejected'],
    SUB_QUEST_STATUS: ['Active', 'Pending', 'Completed', 'Rejected'],
    REWARD_TYPES: ['Item', 'Coin', 'RankPoint', 'BadgePoint', 'LeaderboardScore'],
    DOJO_STATUS: ['Prepare', 'Starting', 'End'],
    SUBMISSION_TYPE: ['Quest', 'Ticket'],
    SUBMISSION_STATUS: ['Pending', 'Approved', 'Rejected'],
    INVENTORY_ITEM_KIND: ['Normal', 'Stackable', 'Ticket']
};

module.exports = CONSTANTS;
