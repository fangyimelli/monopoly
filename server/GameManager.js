const { v4: uuidv4 } = require('uuid');

class GameManager {
    constructor() {
        this.rooms = new Map();
        this.playerRooms = new Map(); // Track which room each player is in
    }

    createRoom(playerId, playerName, character = 'hat') {
        const roomCode = this.generateRoomCode();
        const game = new MonopolyGame();
        
        game.addPlayer(playerId, playerName, character);
        this.rooms.set(roomCode, game);
        this.playerRooms.set(playerId, roomCode);

        return {
            roomCode,
            gameState: game.getGameState(),
            availableCharacters: game.getAvailableCharacters()
        };
    }

    joinRoom(playerId, roomCode, playerName, character = 'hat') {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }

        if (game.players.size >= 8) {
            return { success: false, message: 'Room is full (max 8 players)' };
        }

        if (game.gameStarted) {
            return { success: false, message: 'Game already started' };
        }

        // Check if character is available
        const availableCharacters = game.getAvailableCharacters();
        if (!availableCharacters.includes(character)) {
            character = availableCharacters[0] || 'hat';
        }

        game.addPlayer(playerId, playerName, character);
        this.playerRooms.set(playerId, roomCode);

        return {
            success: true,
            gameState: game.getGameState(),
            availableCharacters: game.getAvailableCharacters(),
            assignedCharacter: character
        };
    }

    startGame(roomCode, playerId) {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }

        if (game.players.size < 2) {
            return { success: false, message: 'Need at least 2 players to start' };
        }

        if (game.gameStarted) {
            return { success: false, message: 'Game already started' };
        }

        // Only the first player (host) can start the game
        const playerIds = Array.from(game.players.keys());
        if (playerId !== playerIds[0]) {
            return { success: false, message: 'Only the host can start the game' };
        }

        game.startGame();
        return {
            success: true,
            gameState: game.getGameState()
        };
    }

    rollDice(roomCode, playerId) {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }

        if (!game.gameStarted) {
            return { success: false, message: 'Game not started' };
        }

        if (game.currentPlayer !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        const dice = game.rollDice();
        return {
            success: true,
            dice,
            gameState: game.getGameState()
        };
    }

    buyProperty(roomCode, playerId, propertyId) {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }

        if (game.currentPlayer !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        const result = game.buyProperty(playerId, propertyId);
        return {
            success: result.success,
            message: result.message,
            gameState: game.getGameState()
        };
    }

    buildHouse(roomCode, playerId, propertyId) {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }

        const result = game.buildHouse(playerId, propertyId);
        return {
            success: result.success,
            message: result.message,
            gameState: game.getGameState()
        };
    }

    endTurn(roomCode, playerId) {
        const game = this.rooms.get(roomCode);
        if (!game) {
            return { success: false, message: 'Room not found' };
        }

        if (game.currentPlayer !== playerId) {
            return { success: false, message: 'Not your turn' };
        }

        game.endTurn();
        return {
            success: true,
            gameState: game.getGameState()
        };
    }

    removePlayer(playerId) {
        return this.handleDisconnection(playerId);
    }

    handleDisconnection(playerId) {
        const roomCode = this.playerRooms.get(playerId);
        if (!roomCode) {
            return {};
        }

        const game = this.rooms.get(roomCode);
        if (game) {
            game.removePlayer(playerId);
            
            // If no players left, delete the room
            if (game.players.size === 0) {
                this.rooms.delete(roomCode);
            }
            
            this.playerRooms.delete(playerId);
            
            return {
                roomCode,
                gameState: game.getGameState()
            };
        }

        return {};
    }

    generateRoomCode() {
        return Math.random().toString(36).substring(2, 8).toUpperCase();
    }
}

// Monopoly Game Logic
class MonopolyGame {
    constructor() {
        this.players = new Map();
        this.properties = this.initializeProperties();
        this.chanceCards = this.initializeChanceCards();
        this.communityChestCards = this.initializeCommunityChestCards();
        this.currentPlayer = null;
        this.gameStarted = false;
        this.playerOrder = [];
        this.currentPlayerIndex = 0;
        this.houses = 32;
        this.hotels = 12;
        this.currentRoll = null;
        this.doubleRollCount = 0;
    }

    addPlayer(playerId, playerName, character = 'hat') {
        // Check if character is already taken
        const existingPlayer = Array.from(this.players.values()).find(p => p.character === character);
        if (existingPlayer) {
            // Auto-assign next available character
            character = this.getNextAvailableCharacter();
        }

        const player = {
            id: playerId,
            name: playerName,
            character: character,
            position: 0,
            money: 1500,
            properties: [],
            inJail: false,
            jailTurns: 0,
            getOutOfJailCards: 0,
            color: this.getPlayerColor(this.players.size)
        };
        
        this.players.set(playerId, player);
    }

    getNextAvailableCharacter() {
        const availableCharacters = [
            'hat', 'car', 'dog', 'cat', 'ship', 'plane', 'boot', 'thimble'
        ];
        
        const usedCharacters = Array.from(this.players.values()).map(p => p.character);
        const available = availableCharacters.find(char => !usedCharacters.includes(char));
        
        return available || 'hat'; // Fallback to hat if all taken
    }

    getAvailableCharacters() {
        const allCharacters = [
            'hat', 'car', 'dog', 'cat', 'ship', 'plane', 'boot', 'thimble'
        ];
        
        const usedCharacters = Array.from(this.players.values()).map(p => p.character);
        return allCharacters.filter(char => !usedCharacters.includes(char));
    }

    removePlayer(playerId) {
        this.players.delete(playerId);
        this.playerOrder = this.playerOrder.filter(id => id !== playerId);
        
        // Adjust current player index if needed
        if (this.currentPlayerIndex >= this.playerOrder.length && this.playerOrder.length > 0) {
            this.currentPlayerIndex = 0;
        }
        
        if (this.playerOrder.length > 0) {
            this.currentPlayer = this.playerOrder[this.currentPlayerIndex];
        } else {
            this.currentPlayer = null;
            this.gameStarted = false;
        }
    }

    startGame() {
        this.gameStarted = true;
        this.playerOrder = Array.from(this.players.keys());
        this.currentPlayerIndex = 0;
        this.currentPlayer = this.playerOrder[0];
    }

    rollDice() {
        const dice1 = Math.floor(Math.random() * 6) + 1;
        const dice2 = Math.floor(Math.random() * 6) + 1;
        const total = dice1 + dice2;
        const isDouble = dice1 === dice2;

        this.currentRoll = { dice1, dice2, total, isDouble };

        const player = this.players.get(this.currentPlayer);
        
        if (isDouble) {
            this.doubleRollCount++;
            if (this.doubleRollCount >= 3) {
                // Go to jail on third double
                this.sendPlayerToJail(this.currentPlayer);
                this.doubleRollCount = 0;
                return this.currentRoll;
            }
        } else {
            this.doubleRollCount = 0;
        }

        // Move player
        this.movePlayer(this.currentPlayer, total);

        return this.currentRoll;
    }

    movePlayer(playerId, spaces) {
        const player = this.players.get(playerId);
        const oldPosition = player.position;
        player.position = (player.position + spaces) % 40;

        // Check if passed GO
        if (oldPosition + spaces >= 40) {
            player.money += 200; // Collect $200 for passing GO
        }

        // Handle landing on a space
        this.handleSpaceLanding(playerId, player.position);
    }

    handleSpaceLanding(playerId, position) {
        const player = this.players.get(playerId);
        const space = this.getSpaceInfo(position);

        switch (space.type) {
            case 'property':
            case 'railroad':
            case 'utility':
                this.handlePropertyLanding(playerId, position);
                break;
            case 'chance':
                this.drawChanceCard(playerId);
                break;
            case 'community_chest':
                this.drawCommunityChestCard(playerId);
                break;
            case 'tax':
                this.collectTax(playerId, space.amount);
                break;
            case 'go_to_jail':
                this.sendPlayerToJail(playerId);
                break;
            case 'jail':
            case 'free_parking':
            case 'go':
                // No action needed
                break;
        }
    }

    handlePropertyLanding(playerId, position) {
        const property = this.properties.get(position);
        const player = this.players.get(playerId);

        if (!property.owner) {
            // Property is available for purchase
            return;
        }

        if (property.owner === playerId) {
            // Player owns the property
            return;
        }

        if (property.mortgaged) {
            // No rent on mortgaged property
            return;
        }

        // Pay rent
        const rent = this.calculateRent(position, property.owner);
        const owner = this.players.get(property.owner);
        
        if (player.money >= rent) {
            player.money -= rent;
            owner.money += rent;
        } else {
            // Player can't afford rent - handle bankruptcy
            this.handleBankruptcy(playerId, property.owner, rent);
        }
    }

    calculateRent(position, ownerId) {
        const property = this.properties.get(position);
        const owner = this.players.get(ownerId);

        if (property.type === 'railroad') {
            const railroadsOwned = this.countRailroadsOwned(ownerId);
            return property.rent[railroadsOwned - 1];
        }

        if (property.type === 'utility') {
            const utilitiesOwned = this.countUtilitiesOwned(ownerId);
            const multiplier = utilitiesOwned === 1 ? 4 : 10;
            return this.currentRoll ? this.currentRoll.total * multiplier : 0;
        }

        if (property.houses === 0 && property.hotels === 0) {
            // Check if owner has monopoly
            const hasMonopoly = this.hasMonopoly(ownerId, property.colorGroup);
            return hasMonopoly ? property.rent[0] * 2 : property.rent[0];
        }

        if (property.hotels > 0) {
            return property.rent[5]; // Hotel rent
        }

        return property.rent[property.houses]; // House rent
    }

    buyProperty(playerId, propertyId) {
        const property = this.properties.get(propertyId);
        const player = this.players.get(playerId);

        if (!property) {
            return { success: false, message: 'Property not found' };
        }

        if (property.owner) {
            return { success: false, message: 'Property already owned' };
        }

        if (player.money < property.price) {
            return { success: false, message: 'Insufficient funds' };
        }

        player.money -= property.price;
        property.owner = playerId;
        player.properties.push(propertyId);

        return { success: true };
    }

    buildHouse(playerId, propertyId) {
        const property = this.properties.get(propertyId);
        const player = this.players.get(playerId);

        if (!property || property.owner !== playerId) {
            return { success: false, message: 'You do not own this property' };
        }

        if (property.type !== 'property') {
            return { success: false, message: 'Cannot build on this type of property' };
        }

        if (!this.hasMonopoly(playerId, property.colorGroup)) {
            return { success: false, message: 'Need monopoly to build houses' };
        }

        if (property.hotels > 0) {
            return { success: false, message: 'Property already has a hotel' };
        }

        if (property.houses >= 4) {
            return { success: false, message: 'Maximum houses reached. Build hotel instead.' };
        }

        if (this.houses <= 0) {
            return { success: false, message: 'No houses available' };
        }

        if (player.money < property.housePrice) {
            return { success: false, message: 'Insufficient funds' };
        }

        // Check even building rule
        if (!this.canBuildEvenly(playerId, property.colorGroup, propertyId)) {
            return { success: false, message: 'Must build evenly across color group' };
        }

        player.money -= property.housePrice;
        property.houses++;
        this.houses--;

        return { success: true };
    }

    endTurn() {
        // Check if player gets another turn from doubles
        if (this.currentRoll && this.currentRoll.isDouble && this.doubleRollCount < 3) {
            // Player gets another turn
            return;
        }

        this.doubleRollCount = 0;
        this.currentRoll = null;
        
        // Move to next player
        this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.playerOrder.length;
        this.currentPlayer = this.playerOrder[this.currentPlayerIndex];
    }

    getGameState() {
        return {
            players: Array.from(this.players.values()),
            properties: Array.from(this.properties.entries()).map(([id, prop]) => ({ id, ...prop })),
            currentPlayer: this.currentPlayer,
            currentPlayerIndex: this.currentPlayerIndex,
            gameStarted: this.gameStarted,
            currentRoll: this.currentRoll,
            houses: this.houses,
            hotels: this.hotels
        };
    }

    // Helper methods
    getPlayerColor(index) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff', '#orange', '#purple'];
        return colors[index % colors.length];
    }

    getSpaceInfo(position) {
        const spaces = [
            { type: 'go', name: 'GO' },
            { type: 'property', name: 'Mediterranean Avenue' },
            { type: 'community_chest', name: 'Community Chest' },
            { type: 'property', name: 'Baltic Avenue' },
            { type: 'tax', name: 'Income Tax', amount: 200 },
            { type: 'railroad', name: 'Reading Railroad' },
            { type: 'property', name: 'Oriental Avenue' },
            { type: 'chance', name: 'Chance' },
            { type: 'property', name: 'Vermont Avenue' },
            { type: 'property', name: 'Connecticut Avenue' },
            { type: 'jail', name: 'Jail' },
            { type: 'property', name: 'St. Charles Place' },
            { type: 'utility', name: 'Electric Company' },
            { type: 'property', name: 'States Avenue' },
            { type: 'property', name: 'Virginia Avenue' },
            { type: 'railroad', name: 'Pennsylvania Railroad' },
            { type: 'property', name: 'St. James Place' },
            { type: 'community_chest', name: 'Community Chest' },
            { type: 'property', name: 'Tennessee Avenue' },
            { type: 'property', name: 'New York Avenue' },
            { type: 'free_parking', name: 'Free Parking' },
            { type: 'property', name: 'Kentucky Avenue' },
            { type: 'chance', name: 'Chance' },
            { type: 'property', name: 'Indiana Avenue' },
            { type: 'property', name: 'Illinois Avenue' },
            { type: 'railroad', name: 'B&O Railroad' },
            { type: 'property', name: 'Atlantic Avenue' },
            { type: 'property', name: 'Ventnor Avenue' },
            { type: 'utility', name: 'Water Works' },
            { type: 'property', name: 'Marvin Gardens' },
            { type: 'go_to_jail', name: 'Go To Jail' },
            { type: 'property', name: 'Pacific Avenue' },
            { type: 'property', name: 'North Carolina Avenue' },
            { type: 'community_chest', name: 'Community Chest' },
            { type: 'property', name: 'Pennsylvania Avenue' },
            { type: 'railroad', name: 'Short Line' },
            { type: 'chance', name: 'Chance' },
            { type: 'property', name: 'Park Place' },
            { type: 'tax', name: 'Luxury Tax', amount: 100 },
            { type: 'property', name: 'Boardwalk' }
        ];
        
        return spaces[position] || { type: 'unknown', name: 'Unknown' };
    }

    initializeProperties() {
        const properties = new Map();
        
        // Property data with prices, rents, etc.
        const propertyData = [
            { id: 1, name: 'Mediterranean Avenue', price: 60, rent: [2, 10, 30, 90, 160, 250], colorGroup: 'brown', housePrice: 50 },
            { id: 3, name: 'Baltic Avenue', price: 60, rent: [4, 20, 60, 180, 320, 450], colorGroup: 'brown', housePrice: 50 },
            { id: 5, name: 'Reading Railroad', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 6, name: 'Oriental Avenue', price: 100, rent: [6, 30, 90, 270, 400, 550], colorGroup: 'lightblue', housePrice: 50 },
            { id: 8, name: 'Vermont Avenue', price: 100, rent: [6, 30, 90, 270, 400, 550], colorGroup: 'lightblue', housePrice: 50 },
            { id: 9, name: 'Connecticut Avenue', price: 120, rent: [8, 40, 100, 300, 450, 600], colorGroup: 'lightblue', housePrice: 50 },
            { id: 11, name: 'St. Charles Place', price: 140, rent: [10, 50, 150, 450, 625, 750], colorGroup: 'pink', housePrice: 100 },
            { id: 12, name: 'Electric Company', price: 150, type: 'utility' },
            { id: 13, name: 'States Avenue', price: 140, rent: [10, 50, 150, 450, 625, 750], colorGroup: 'pink', housePrice: 100 },
            { id: 14, name: 'Virginia Avenue', price: 160, rent: [12, 60, 180, 500, 700, 900], colorGroup: 'pink', housePrice: 100 },
            { id: 15, name: 'Pennsylvania Railroad', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 16, name: 'St. James Place', price: 180, rent: [14, 70, 200, 550, 750, 950], colorGroup: 'orange', housePrice: 100 },
            { id: 18, name: 'Tennessee Avenue', price: 180, rent: [14, 70, 200, 550, 750, 950], colorGroup: 'orange', housePrice: 100 },
            { id: 19, name: 'New York Avenue', price: 200, rent: [16, 80, 220, 600, 800, 1000], colorGroup: 'orange', housePrice: 100 },
            { id: 21, name: 'Kentucky Avenue', price: 220, rent: [18, 90, 250, 700, 875, 1050], colorGroup: 'red', housePrice: 150 },
            { id: 23, name: 'Indiana Avenue', price: 220, rent: [18, 90, 250, 700, 875, 1050], colorGroup: 'red', housePrice: 150 },
            { id: 24, name: 'Illinois Avenue', price: 240, rent: [20, 100, 300, 750, 925, 1100], colorGroup: 'red', housePrice: 150 },
            { id: 25, name: 'B&O Railroad', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 26, name: 'Atlantic Avenue', price: 260, rent: [22, 110, 330, 800, 975, 1150], colorGroup: 'yellow', housePrice: 150 },
            { id: 27, name: 'Ventnor Avenue', price: 260, rent: [22, 110, 330, 800, 975, 1150], colorGroup: 'yellow', housePrice: 150 },
            { id: 28, name: 'Water Works', price: 150, type: 'utility' },
            { id: 29, name: 'Marvin Gardens', price: 280, rent: [24, 120, 360, 850, 1025, 1200], colorGroup: 'yellow', housePrice: 150 },
            { id: 31, name: 'Pacific Avenue', price: 300, rent: [26, 130, 390, 900, 1100, 1275], colorGroup: 'green', housePrice: 200 },
            { id: 32, name: 'North Carolina Avenue', price: 300, rent: [26, 130, 390, 900, 1100, 1275], colorGroup: 'green', housePrice: 200 },
            { id: 34, name: 'Pennsylvania Avenue', price: 320, rent: [28, 150, 450, 1000, 1200, 1400], colorGroup: 'green', housePrice: 200 },
            { id: 35, name: 'Short Line', price: 200, rent: [25, 50, 100, 200], type: 'railroad' },
            { id: 37, name: 'Park Place', price: 350, rent: [35, 175, 500, 1100, 1300, 1500], colorGroup: 'darkblue', housePrice: 200 },
            { id: 39, name: 'Boardwalk', price: 400, rent: [50, 200, 600, 1400, 1700, 2000], colorGroup: 'darkblue', housePrice: 200 }
        ];

        propertyData.forEach(prop => {
            properties.set(prop.id, {
                ...prop,
                type: prop.type || 'property',
                owner: null,
                houses: 0,
                hotels: 0,
                mortgaged: false
            });
        });

        return properties;
    }

    initializeChanceCards() {
        return [
            { text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
            { text: 'Go to Jail – do not pass Go, do not collect $200', action: 'jail' },
            { text: 'Pay poor tax of $15', action: 'pay', amount: 15 },
            { text: 'Your building loan matures – Receive $150', action: 'receive', amount: 150 },
            { text: 'Go back 3 spaces', action: 'moveRelative', spaces: -3 },
            { text: 'Get out of Jail Free', action: 'jailCard' }
        ];
    }

    initializeCommunityChestCards() {
        return [
            { text: 'Advance to GO (Collect $200)', action: 'move', target: 0 },
            { text: 'Bank error in your favor – Collect $200', action: 'receive', amount: 200 },
            { text: 'Doctor\'s fee – Pay $50', action: 'pay', amount: 50 },
            { text: 'From sale of stock you get $50', action: 'receive', amount: 50 },
            { text: 'Go to Jail – do not pass Go, do not collect $200', action: 'jail' },
            { text: 'Get out of Jail Free', action: 'jailCard' }
        ];
    }

    // Additional helper methods would go here...
    hasMonopoly(playerId, colorGroup) {
        const groupProperties = Array.from(this.properties.values()).filter(p => p.colorGroup === colorGroup);
        return groupProperties.every(p => p.owner === playerId);
    }

    countRailroadsOwned(playerId) {
        return Array.from(this.properties.values()).filter(p => p.type === 'railroad' && p.owner === playerId).length;
    }

    countUtilitiesOwned(playerId) {
        return Array.from(this.properties.values()).filter(p => p.type === 'utility' && p.owner === playerId).length;
    }

    canBuildEvenly(playerId, colorGroup, propertyId) {
        const groupProperties = Array.from(this.properties.values()).filter(p => p.colorGroup === colorGroup && p.owner === playerId);
        const currentProperty = this.properties.get(propertyId);
        const minHouses = Math.min(...groupProperties.map(p => p.houses));
        
        return currentProperty.houses === minHouses;
    }

    sendPlayerToJail(playerId) {
        const player = this.players.get(playerId);
        player.position = 10; // Jail position
        player.inJail = true;
        player.jailTurns = 0;
    }

    collectTax(playerId, amount) {
        const player = this.players.get(playerId);
        player.money -= amount;
        if (player.money < 0) {
            this.handleBankruptcy(playerId, null, Math.abs(player.money));
        }
    }

    drawChanceCard(playerId) {
        // Implementation for drawing and executing chance cards
        const card = this.chanceCards[Math.floor(Math.random() * this.chanceCards.length)];
        this.executeCard(playerId, card);
    }

    drawCommunityChestCard(playerId) {
        // Implementation for drawing and executing community chest cards
        const card = this.communityChestCards[Math.floor(Math.random() * this.communityChestCards.length)];
        this.executeCard(playerId, card);
    }

    executeCard(playerId, card) {
        const player = this.players.get(playerId);
        
        switch (card.action) {
            case 'move':
                player.position = card.target;
                this.handleSpaceLanding(playerId, card.target);
                break;
            case 'moveRelative':
                this.movePlayer(playerId, card.spaces);
                break;
            case 'pay':
                player.money -= card.amount;
                break;
            case 'receive':
                player.money += card.amount;
                break;
            case 'jail':
                this.sendPlayerToJail(playerId);
                break;
            case 'jailCard':
                player.getOutOfJailCards++;
                break;
        }
    }

    handleBankruptcy(playerId, creditorId, debt) {
        const player = this.players.get(playerId);
        
        // Sell all houses and hotels
        player.properties.forEach(propId => {
            const property = this.properties.get(propId);
            if (property.houses > 0) {
                player.money += (property.houses * property.housePrice) / 2;
                this.houses += property.houses;
                property.houses = 0;
            }
            if (property.hotels > 0) {
                player.money += (property.housePrice * 5) / 2; // Hotel = 5 houses worth
                this.hotels += property.hotels;
                property.hotels = 0;
            }
        });

        // If still can't pay, transfer all assets
        if (player.money < debt) {
            if (creditorId) {
                // Transfer to creditor
                const creditor = this.players.get(creditorId);
                creditor.money += player.money;
                
                player.properties.forEach(propId => {
                    const property = this.properties.get(propId);
                    property.owner = creditorId;
                    creditor.properties.push(propId);
                });
            } else {
                // Transfer to bank (auction properties)
                player.properties.forEach(propId => {
                    const property = this.properties.get(propId);
                    property.owner = null;
                    property.mortgaged = false;
                });
            }
            
            // Remove player from game
            this.removePlayer(playerId);
        }
    }
}

module.exports = GameManager;
