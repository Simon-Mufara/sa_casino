import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

const playerNames = ['You', 'CPU 1', 'CPU 2', 'CPU 3'];

const suits = [
  { symbol: '♠', color: '#1a1a1a' },
  { symbol: '♥', color: '#cc2200' },
  { symbol: '♦', color: '#cc2200' },
  { symbol: '♣', color: '#1a1a1a' },
];

const ranks = Array.from({ length: 10 }, (_, index) => index + 1);

function makeCard(rank, suit, id) {
  return {
    id,
    rank,
    suit,
    display: rank === 1 ? 'A' : String(rank),
  };
}

function createDeck() {
  return suits.flatMap((suit) => ranks.map((rank) => makeCard(rank, suit.symbol, `${suit.symbol}-${rank}`)));
}

function shuffleDeck(deck) {
  const nextDeck = [...deck];

  for (let index = nextDeck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [nextDeck[index], nextDeck[swapIndex]] = [nextDeck[swapIndex], nextDeck[index]];
  }

  return nextDeck;
}

function takeCards(deck, count) {
  return deck.splice(0, count);
}

function createPlayers(playerCount) {
  return Array.from({ length: playerCount }, (_, index) => ({
    id: `player-${index + 1}`,
    name: playerNames[index] ?? `Player ${index + 1}`,
    isHuman: index === 0,
    hand: [],
    capturePile: [],
    builds: [],
  }));
}

function createInitialGameState(playerCount = 2, dealRound = 1) {
  return {
    phase: 'setup',
    playerCount,
    players: createPlayers(playerCount),
    tableCards: [],
    tableBuilds: [],
    deck: createDeck(),
    currentPlayerIndex: 0,
    dealRound,
    lastCapturePlayerId: null,
    gameLog: [],
  };
}

function createDemoBuilds(playerCount, dealRound) {
  const humanBuild = {
    id: 'build-human-7',
    cards: [makeCard(2, '♦', 'build-human-7-a'), makeCard(5, '♣', 'build-human-7-b')],
    targetValue: 7,
    ownerId: 'player-1',
    ownerName: 'You',
    ownerColor: '#C9A84C',
    isCompound: false,
    stashed: false,
    topCard: makeCard(5, '♣', 'build-human-7-b'),
  };

  const cpuBuild = {
    id: 'build-cpu-10',
    cards: [makeCard(3, '♠', 'build-cpu-10-a'), makeCard(7, '♥', 'build-cpu-10-b')],
    targetValue: 10,
    ownerId: 'player-2',
    ownerName: 'CPU 1',
    ownerColor: '#7CC4F3',
    isCompound: true,
    stashed: true,
    topCard: makeCard(7, '♥', 'build-cpu-10-b'),
  };

  if (playerCount === 2 && dealRound === 1) {
    return [humanBuild, cpuBuild];
  }

  return [
    {
      ...humanBuild,
      ownerId: 'player-2',
      ownerName: 'CPU 1',
      ownerColor: '#7CC4F3',
    },
    cpuBuild,
  ];
}

function createDemoPlayingState(playerCount, dealRound) {
  const deck = shuffleDeck(createDeck());
  const players = createPlayers(playerCount);
  const handSize = playerCount === 3 ? 13 : 10;

  players.forEach((player) => {
    player.hand = takeCards(deck, handSize);
  });

  const tableCards = [
    makeCard(3, '♠', 'table-3-spades'),
    makeCard(5, '♥', 'table-5-hearts'),
    makeCard(8, '♦', 'table-8-diamonds'),
    makeCard(2, '♣', 'table-2-clubs'),
    makeCard(6, '♠', 'table-6-spades'),
  ];

  const tableBuilds = createDemoBuilds(playerCount, dealRound);
  players[0].builds = playerCount === 2 && dealRound === 1 ? [tableBuilds[0]] : [];
  players[1].builds = [tableBuilds[1]];
  players[1].capturePile = [makeCard(2, '♦', 'cpu1-pile-top'), makeCard(4, '♥', 'cpu1-pile-bottom')];
  if (players[2]) {
    players[2].capturePile = [makeCard(7, '♣', 'cpu2-pile-top')];
  }
  if (players[3]) {
    players[3].capturePile = [makeCard(9, '♠', 'cpu3-pile-top')];
  }

  return {
    phase: 'playing',
    playerCount,
    players,
    tableCards,
    tableBuilds,
    deck,
    currentPlayerIndex: 0,
    dealRound,
    lastCapturePlayerId: null,
    gameLog: [`${playerNames[0]} to play.`],
  };
}

function getCardMeta(card) {
  const isSpecialMummy = card.rank === 10 && card.suit === '♦';
  const isSpyTwo = card.rank === 2 && card.suit === '♠';
  const isAce = card.rank === 1;

  return {
    isSpecial: isSpecialMummy || isSpyTwo || isAce,
    specialLabel: isSpecialMummy ? 'Mummy' : isSpyTwo ? 'Spy Two' : isAce ? 'Ace' : '',
    points: isSpecialMummy ? 2 : 1,
  };
}

function sortAscendingCards(cards) {
  return [...cards].sort((left, right) => left.rank - right.rank || left.suit.localeCompare(right.suit) || left.id.localeCompare(right.id));
}

function describeCard(card) {
  return `${card.display}${card.suit}`;
}

function describeCards(cards) {
  return cards.map(describeCard).join(', ');
}

function getCardAriaLabel(card, actions = []) {
  const actionText = actions.length > 0 ? ` Actions: ${actions.join(', ')}.` : '';
  return `${card.display} of ${card.suit}.${actionText}`;
}

const quickReferenceRows = [
  { action: 'Chow!', description: 'Capture table cards that add up to the selected card.' },
  { action: 'Build', description: 'Stack cards into a new build, change one, or augment an existing build.' },
  { action: 'Stash', description: 'Hide a card on a build you own to strengthen it.' },
  { action: 'Drift', description: 'Play a card to the table without capturing.' },
];

function getVisibleTargets(gameState) {
  const targets = [];

  gameState.tableCards.forEach((card) => {
    targets.push({
      id: `table-${card.id}`,
      type: 'table-card',
      value: card.rank,
      cards: [card],
      label: describeCard(card),
      ownerId: null,
    });
  });

  gameState.tableBuilds.forEach((build) => {
    targets.push({
      id: `build-${build.id}`,
      type: 'build',
      buildId: build.id,
      value: build.targetValue,
      cards: build.cards,
      label: `Build ${build.targetValue}`,
      ownerId: build.ownerId,
      ownerName: build.ownerName,
      ownerColor: build.ownerColor,
      isCompound: build.isCompound,
      stashed: build.stashed,
    });
  });

  gameState.players.slice(1).forEach((player) => {
    const topCard = player.capturePile[0];

    if (topCard) {
      targets.push({
        id: `capture-${player.id}`,
        type: 'capture-top',
        value: topCard.rank,
        cards: [topCard],
        label: `${player.name} top`,
        ownerId: player.id,
      });
    }
  });

  return targets;
}

function getBuildOwnershipColor(ownerId) {
  const colors = {
    'player-1': '#C9A84C',
    'player-2': '#7CC4F3',
    'player-3': '#F48FB1',
    'player-4': '#9CCC65',
  };

  return colors[ownerId] ?? '#C9A84C';
}

function getBuildOwnershipName(gameState, ownerId) {
  return gameState.players.find((player) => player.id === ownerId)?.name ?? 'Unknown';
}

function getNextPlayerIndex(gameState, currentPlayerIndex = gameState.currentPlayerIndex) {
  return (currentPlayerIndex + 1) % gameState.playerCount;
}

function getPartnerIndex(playerIndex, playerCount) {
  if (playerCount !== 4) {
    return null;
  }

  const partnerMap = new Map([
    [0, 2],
    [2, 0],
    [1, 3],
    [3, 1],
  ]);

  return partnerMap.get(playerIndex) ?? null;
}

function getSeatPosition(playerIndex, playerCount) {
  if (playerCount === 2) {
    return playerIndex === 0 ? 'bottom' : 'top';
  }

  if (playerCount === 3) {
    if (playerIndex === 0) return 'bottom';
    if (playerIndex === 1) return 'top-right';
    return 'top-left';
  }

  if (playerCount === 4) {
    if (playerIndex === 0) return 'bottom';
    if (playerIndex === 1) return 'right';
    if (playerIndex === 2) return 'top';
    return 'left';
  }

  return 'bottom';
}

function isSpecialPriorityCard(card) {
  return card.rank === 10 && card.suit === '♦' || card.rank === 2 && card.suit === '♠' || card.rank === 1;
}

function getSpecialCardPriority(card) {
  if (card.rank === 10 && card.suit === '♦') return 3;
  if (card.rank === 2 && card.suit === '♠') return 2;
  if (card.rank === 1) return 1;
  return 0;
}

function getCaptureTargetPriority(target) {
  if (!target) {
    return 0;
  }

  const targetCards = target.cards ?? [];
  return targetCards.reduce((sum, card) => sum + getSpecialCardPriority(card), 0);
}

function getPlayerIndexById(gameState, playerId) {
  return gameState.players.findIndex((player) => player.id === playerId);
}

function buildTargetMap(gameState) {
  return new Map(getVisibleTargets(gameState).map((target) => [target.id, target]));
}

function findFloorSubsets(floorCards, targetValue) {
  const subsets = [];

  function search(startIndex, runningValue, selectedCards) {
    if (runningValue === targetValue && selectedCards.length > 0) {
      subsets.push([...selectedCards]);
      return;
    }

    if (runningValue >= targetValue) {
      return;
    }

    for (let index = startIndex; index < floorCards.length; index += 1) {
      const nextCard = floorCards[index];
      selectedCards.push(nextCard);
      search(index + 1, runningValue + nextCard.rank, selectedCards);
      selectedCards.pop();
    }
  }

  search(0, 0, []);
  return subsets;
}

function countSpecialTargets(targets) {
  return targets.reduce((count, target) => count + target.cards.reduce((cardCount, card) => cardCount + (isSpecialPriorityCard(card) ? 1 : 0), 0), 0);
}

function sortByBestCapture(options) {
  return [...options].sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
    if (right.cardCount !== left.cardCount) return right.cardCount - left.cardCount;
    if (right.specialScore !== left.specialScore) return right.specialScore - left.specialScore;
    return left.card.rank - right.card.rank;
  });
}

function getCpuCaptureOptions(gameState, playerIndex) {
  const player = gameState.players[playerIndex];
  const targetMap = buildTargetMap(gameState);
  const visibleTargets = [...targetMap.values()];
  const options = [];

  player.hand.forEach((card) => {
    const subsets = findLegalCaptureSubsets(card, visibleTargets);

    subsets.forEach((subsetIds) => {
      const targets = subsetIds.map((targetId) => targetMap.get(targetId)).filter(Boolean);
      const specialScore = countSpecialTargets(targets);
      const ownBuildScore = targets.reduce((score, target) => score + (target.type === 'build' && target.ownerId === player.id ? 1 : 0), 0);
      const maxCardsScore = targets.length;
      const priorityScore = specialScore > 0 ? 500 + specialScore * 100 : ownBuildScore > 0 ? 400 + maxCardsScore * 10 : 100 + maxCardsScore * 5;

      options.push({
        type: 'capture',
        card,
        targetIds: subsetIds,
        targets,
        priorityScore,
        specialScore,
        cardCount: targets.length,
      });
    });
  });

  return sortByBestCapture(options);
}

function getCpuBuildCreateOptions(gameState, playerIndex, preferredValues = []) {
  const player = gameState.players[playerIndex];

  if (player.builds.length > 0) {
    return [];
  }

  const floorCards = gameState.tableCards;
  const options = [];

  player.hand.forEach((card) => {
    const shouldConsider = preferredValues.length === 0 ? true : preferredValues.includes(card.rank);
    if (!shouldConsider) {
      return;
    }

    const subsets = findFloorSubsets(floorCards, card.rank);

    subsets.forEach((subset) => {
      const specialScore = subset.reduce((sum, floorCard) => sum + getSpecialCardPriority(floorCard), 0);
      options.push({
        type: 'build-create',
        card,
        floorCards: subset,
        targetValue: card.rank,
        priorityScore: 200 + specialScore * 10 + subset.length,
        specialScore,
        cardCount: subset.length,
      });
    });
  });

  return options.sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) return right.priorityScore - left.priorityScore;
    if (right.cardCount !== left.cardCount) return right.cardCount - left.cardCount;
    return right.targetValue - left.targetValue;
  });
}

function getCpuBuildChangeOptions(gameState, playerIndex) {
  const player = gameState.players[playerIndex];
  const targetMap = buildTargetMap(gameState);
  const options = [];

  gameState.tableBuilds.forEach((build) => {
    if (build.isCompound || build.ownerId === player.id) {
      return;
    }

    player.hand.forEach((card) => {
      const newTargetValue = build.targetValue + card.rank;
      const claimCard = player.hand.find((nextCard) => nextCard.id !== card.id && nextCard.rank === newTargetValue);

      if (!claimCard) {
        return;
      }

      const potentialCaptureOptions = findLegalCaptureSubsets(makeCard(newTargetValue, '♠', `virtual-${newTargetValue}`), [...targetMap.values()]);

      if (potentialCaptureOptions.length === 0) {
        return;
      }

      options.push({
        type: 'build-change',
        card,
        buildId: build.id,
        targetValue: newTargetValue,
        claimCard,
        priorityScore: 300 + potentialCaptureOptions.length * 20 + (newTargetValue === 10 ? 50 : 0),
      });
    });
  });

  return options.sort((left, right) => right.priorityScore - left.priorityScore);
}

function getCpuBuildAugmentOptions(gameState, playerIndex) {
  const player = gameState.players[playerIndex];
  const targetMap = buildTargetMap(gameState);

  const options = [];

  player.builds.forEach((build) => {
    if (build.ownerId !== player.id) {
      return;
    }

    const floorCards = gameState.tableCards;
    const boardTargets = getVisibleTargets(gameState).filter((target) => target.type === 'capture-top');

    player.hand.forEach((card) => {
      const needed = build.targetValue - card.rank;
      if (needed < 0) {
        return;
      }

      const candidateCards = [...floorCards, ...boardTargets.flatMap((target) => target.cards)];
      const subsets = findFloorSubsets(candidateCards, needed).filter((subset) => subset.some((subsetCard) => floorCards.some((floorCard) => floorCard.id === subsetCard.id)));
      subsets.forEach((subset) => {
        const specialScore = subset.reduce((sum, subsetCard) => sum + getSpecialCardPriority(subsetCard), 0);
        const captureTopIds = boardTargets
          .filter((target) => subset.some((subsetCard) => target.cards.some((targetCard) => targetCard.id === subsetCard.id)))
          .map((target) => target.id);
        options.push({
          type: 'build-augment',
          card,
          buildId: build.id,
          floorCards: subset,
          captureTopIds,
          priorityScore: 150 + specialScore * 10 + subset.length,
        });
      });
    });
  });

  return options.sort((left, right) => right.priorityScore - left.priorityScore);
}

function getCpuStashOptions(gameState, playerIndex) {
  const player = gameState.players[playerIndex];
  const options = [];

  player.builds.forEach((build) => {
    if (build.ownerId !== player.id || build.isCompound) {
      return;
    }

    player.hand.forEach((card) => {
      if (card.rank !== build.targetValue) {
        return;
      }

      options.push({
        type: 'build-stash',
        card,
        buildId: build.id,
        priorityScore: 120 + build.targetValue,
      });
    });
  });

  return options.sort((left, right) => right.priorityScore - left.priorityScore);
}

function getCpuDriftOption(gameState, playerIndex) {
  const player = gameState.players[playerIndex];
  const specialValues = new Set([1]);
  const candidates = player.hand.filter((card) => !(card.rank === 1 || card.suit === '♠' || (card.rank === 10 && card.suit === '♦') || (card.rank === 2 && card.suit === '♠')));

  if (candidates.length === 0) {
    return null;
  }

  return candidates.sort((left, right) => left.rank - right.rank || left.suit.localeCompare(right.suit))[0];
}

function chooseCpuMove(gameState, playerIndex) {
  const captureOptions = getCpuCaptureOptions(gameState, playerIndex);

  const specialPriority = captureOptions.find((option) => option.targets.some((target) => target.cards.some((card) => getSpecialCardPriority(card) > 0)));
  if (specialPriority) {
    return specialPriority;
  }

  const ownBuildCapture = captureOptions.find((option) => option.targets.some((target) => target.type === 'build' && target.ownerId === gameState.players[playerIndex].id));
  if (ownBuildCapture) {
    return ownBuildCapture;
  }

  const createTenOptions = getCpuBuildCreateOptions(gameState, playerIndex, [10]);
  if (createTenOptions.length > 0) {
    return createTenOptions[0];
  }

  const changeOptions = getCpuBuildChangeOptions(gameState, playerIndex);
  if (changeOptions.length > 0) {
    return changeOptions[0];
  }

  const augmentOptions = getCpuBuildAugmentOptions(gameState, playerIndex);
  if (augmentOptions.length > 0) {
    return augmentOptions[0];
  }

  if (captureOptions.length > 0) {
    return captureOptions[0];
  }

  const specialProtectionOptions = getCpuBuildCreateOptions(gameState, playerIndex, [1, 2, 10]);
  if (specialProtectionOptions.length > 0) {
    return specialProtectionOptions[0];
  }

  const stashOptions = getCpuStashOptions(gameState, playerIndex);
  if (stashOptions.length > 0) {
    return stashOptions[0];
  }

  const driftCard = getCpuDriftOption(gameState, playerIndex);
  if (driftCard) {
    return { type: 'drift', card: driftCard, priorityScore: 1 };
  }

  return null;
}

function removeTargetsFromState(gameState, targetIds) {
  const targetMap = buildTargetMap(gameState);
  const nextState = {
    players: gameState.players.map((player) => ({
      ...player,
      hand: [...player.hand],
      capturePile: [...player.capturePile],
      builds: player.builds.map((build) => ({ ...build, cards: [...build.cards] })),
    })),
    tableCards: [...gameState.tableCards],
    tableBuilds: gameState.tableBuilds.map((build) => ({ ...build, cards: [...build.cards] })),
  };

  targetIds.forEach((targetId) => {
    const target = targetMap.get(targetId);

    if (!target) {
      return;
    }

    if (target.type === 'table-card') {
      nextState.tableCards = nextState.tableCards.filter((card) => card.id !== target.cards[0].id);
      return;
    }

    if (target.type === 'capture-top') {
      const ownerIndex = getPlayerIndexById(gameState, target.ownerId);
      if (ownerIndex >= 0) {
        nextState.players[ownerIndex].capturePile = nextState.players[ownerIndex].capturePile.slice(1);
      }
      return;
    }

    if (target.type === 'build') {
      nextState.tableBuilds = nextState.tableBuilds.filter((build) => build.id !== target.buildId);
      nextState.players = nextState.players.map((player) => ({
        ...player,
        builds: player.builds.filter((build) => build.id !== target.buildId),
      }));
    }
  });

  return nextState;
}

function applyCpuCaptureState(gameState, playerIndex, move) {
  const targetMap = buildTargetMap(gameState);
  const targets = move.targetIds.map((targetId) => targetMap.get(targetId)).filter(Boolean);
  const capturedCards = sortAscendingCards([move.card, ...targets.flatMap((target) => target.cards)]);
  const nextState = removeTargetsFromState(gameState, move.targetIds);
  const nextPlayers = nextState.players.map((player, index) => {
    if (index === playerIndex) {
      return {
        ...player,
        hand: player.hand.filter((card) => card.id !== move.card.id),
        capturePile: [...capturedCards, ...player.capturePile],
      };
    }

    return player;
  });

  return {
    ...gameState,
    players: nextPlayers,
    tableCards: nextState.tableCards,
    tableBuilds: nextState.tableBuilds,
    currentPlayerIndex: getNextPlayerIndex(gameState, playerIndex),
    lastCapturePlayerId: gameState.players[playerIndex].id,
    gameLog: [`${gameState.players[playerIndex].name} chowed ${describeCards(targets.flatMap((target) => target.cards))} with ${describeCard(move.card)}`, ...gameState.gameLog].slice(0, 10),
  };
}

function applyCpuDriftState(gameState, playerIndex, move) {
  const player = gameState.players[playerIndex];
  return {
    ...gameState,
    players: gameState.players.map((entry, index) =>
      index === playerIndex
        ? {
            ...entry,
            hand: entry.hand.filter((card) => card.id !== move.card.id),
          }
        : entry,
    ),
    tableCards: [...gameState.tableCards, move.card],
    currentPlayerIndex: getNextPlayerIndex(gameState, playerIndex),
    gameLog: [`${player.name} drifted ${describeCard(move.card)}`, ...gameState.gameLog].slice(0, 10),
  };
}

function applyCpuBuildCreateState(gameState, playerIndex, move) {
  const player = gameState.players[playerIndex];
  const buildCards = sortAscendingCards(move.floorCards);
  const build = {
    id: `build-${Date.now()}-${move.card.id}`,
    cards: buildCards,
    targetValue: move.targetValue,
    ownerId: player.id,
    ownerName: player.name,
    ownerColor: getBuildOwnershipColor(player.id),
    isCompound: false,
    stashed: false,
    topCard: buildCards[0] ?? move.card,
  };

  return {
    ...gameState,
    players: gameState.players.map((entry, index) =>
      index === playerIndex
        ? {
            ...entry,
            hand: entry.hand.filter((card) => card.id !== move.card.id),
            builds: [...entry.builds, build],
          }
        : entry,
    ),
    tableCards: gameState.tableCards.filter((card) => !move.floorCards.some((floorCard) => floorCard.id === card.id)),
    tableBuilds: [...gameState.tableBuilds, build],
    currentPlayerIndex: getNextPlayerIndex(gameState, playerIndex),
    gameLog: [`${player.name} built ${move.targetValue} (${describeCards(buildCards)})`, ...gameState.gameLog].slice(0, 10),
  };
}

function applyCpuBuildChangeState(gameState, playerIndex, move) {
  const player = gameState.players[playerIndex];
  const buildIndex = gameState.tableBuilds.findIndex((build) => build.id === move.buildId);

  if (buildIndex < 0) {
    return gameState;
  }

  const targetBuild = gameState.tableBuilds[buildIndex];
  const updatedBuild = {
    ...targetBuild,
    cards: [...targetBuild.cards, move.card],
    targetValue: move.targetValue,
    ownerId: player.id,
    ownerName: player.name,
    ownerColor: getBuildOwnershipColor(player.id),
    topCard: move.card,
    isCompound: false,
    stashed: false,
  };

  const nextTableBuilds = [...gameState.tableBuilds];
  nextTableBuilds[buildIndex] = updatedBuild;

  return {
    ...gameState,
    players: gameState.players.map((entry, index) => {
      if (index === playerIndex) {
        return {
          ...entry,
          hand: entry.hand.filter((card) => card.id !== move.card.id),
          builds: entry.builds.some((build) => build.id === move.buildId)
            ? entry.builds.map((build) => (build.id === move.buildId ? updatedBuild : build))
            : [...entry.builds, updatedBuild],
        };
      }

      if (entry.builds.some((build) => build.id === move.buildId)) {
        return {
          ...entry,
          builds: entry.builds.filter((build) => build.id !== move.buildId),
        };
      }

      return entry;
    }),
    tableBuilds: nextTableBuilds,
    currentPlayerIndex: getNextPlayerIndex(gameState, playerIndex),
    gameLog: [`${player.name} changed build ${targetBuild.targetValue} to ${move.targetValue}`, ...gameState.gameLog].slice(0, 10),
  };
}

function applyCpuBuildAugmentState(gameState, playerIndex, move) {
  const player = gameState.players[playerIndex];
  const buildIndex = gameState.tableBuilds.findIndex((build) => build.id === move.buildId);

  if (buildIndex < 0) {
    return gameState;
  }

  const targetBuild = gameState.tableBuilds[buildIndex];
  const floorCards = move.floorCards ?? [];
  const augmentedCards = sortAscendingCards([...targetBuild.cards, ...(move.card ? [move.card] : []), ...floorCards]);
  const removalTargetIds = [
    ...floorCards.map((card) => `table-${card.id}`),
    ...(move.captureTopIds ?? []),
  ];
  const updatedBuild = {
    ...targetBuild,
    cards: augmentedCards,
    isCompound: true,
    stashed: false,
    topCard: augmentedCards[0] ?? targetBuild.topCard,
  };

  const nextState = removeTargetsFromState(gameState, removalTargetIds);
  const nextPlayers = nextState.players.map((entry, index) => {
    if (index === playerIndex) {
      return {
        ...entry,
        hand: move.card ? entry.hand.filter((card) => card.id !== move.card.id) : entry.hand,
        builds: entry.builds.map((build) => (build.id === move.buildId ? updatedBuild : build)),
      };
    }

    return entry;
  });

  const nextTableBuilds = nextState.tableBuilds.map((build) => (build.id === move.buildId ? updatedBuild : build));

  return {
    ...gameState,
    players: nextPlayers,
    tableCards: nextState.tableCards,
    tableBuilds: nextTableBuilds,
    currentPlayerIndex: getNextPlayerIndex(gameState, playerIndex),
    gameLog: [`${player.name} augmented build ${targetBuild.targetValue}`, ...gameState.gameLog].slice(0, 10),
  };
}

function applyCpuBuildStashState(gameState, playerIndex, move) {
  const player = gameState.players[playerIndex];
  const buildIndex = gameState.tableBuilds.findIndex((build) => build.id === move.buildId);

  if (buildIndex < 0) {
    return gameState;
  }

  const targetBuild = gameState.tableBuilds[buildIndex];
  const updatedBuild = {
    ...targetBuild,
    cards: sortAscendingCards([...targetBuild.cards, move.card]),
    isCompound: true,
    stashed: true,
    topCard: move.card,
  };

  const nextPlayers = gameState.players.map((entry, index) => {
    if (index === playerIndex) {
      return {
        ...entry,
        hand: entry.hand.filter((card) => card.id !== move.card.id),
        builds: entry.builds.map((build) => (build.id === move.buildId ? updatedBuild : build)),
      };
    }

    return entry;
  });

  return {
    ...gameState,
    players: nextPlayers,
    tableBuilds: gameState.tableBuilds.map((build) => (build.id === move.buildId ? updatedBuild : build)),
    currentPlayerIndex: getNextPlayerIndex(gameState, playerIndex),
    gameLog: [`${player.name} stashed ${describeCard(move.card)} on build ${targetBuild.targetValue}`, ...gameState.gameLog].slice(0, 10),
  };
}

function applyCpuMoveState(gameState, playerIndex, move) {
  if (!move) {
    return gameState;
  }

  switch (move.type) {
    case 'capture':
      return applyCpuCaptureState(gameState, playerIndex, move);
    case 'drift':
      return applyCpuDriftState(gameState, playerIndex, move);
    case 'build-create':
      return applyCpuBuildCreateState(gameState, playerIndex, move);
    case 'build-change':
      return applyCpuBuildChangeState(gameState, playerIndex, move);
    case 'build-augment':
      return applyCpuBuildAugmentState(gameState, playerIndex, move);
    case 'build-stash':
      return applyCpuBuildStashState(gameState, playerIndex, move);
    default:
      return gameState;
  }
}

function describeCpuMove(gameState, playerIndex, move) {
  const playerName = gameState.players[playerIndex]?.name ?? 'CPU';

  if (!move) {
    return `${playerName} drifted.`;
  }

  if (move.type === 'capture') {
    const targetCards = move.targets.flatMap((target) => target.cards);
    return `${playerName} chowed ${describeCards(targetCards)} with ${describeCard(move.card)}`;
  }

  if (move.type === 'build-create') {
    return `${playerName} built a ${move.targetValue} (${describeCards(move.floorCards)})`;
  }

  if (move.type === 'build-change') {
    return `${playerName} changed a build to ${move.targetValue} with ${describeCard(move.card)}`;
  }

  if (move.type === 'build-augment') {
    const extraCards = [...(move.floorCards ?? []), ...(move.card ? [move.card] : [])];
    return `${playerName} augmented a build with ${describeCards(extraCards)}`;
  }

  if (move.type === 'build-stash') {
    return `${playerName} stashed ${describeCard(move.card)} on a build`;
  }

  if (move.type === 'drift') {
    return `${playerName} drifted ${describeCard(move.card)}`;
  }

  return `${playerName} moved.`;
}

function findLegalCaptureSubsets(card, targets) {
  const legalSubsets = [];

  function explore(startIndex, runningValue, selectedIds) {
    if (runningValue === card.rank && selectedIds.length > 0) {
      legalSubsets.push([...selectedIds]);
      return;
    }

    if (runningValue >= card.rank) {
      return;
    }

    for (let index = startIndex; index < targets.length; index += 1) {
      const target = targets[index];
      if (target.value > card.rank) {
        continue;
      }

      selectedIds.push(target.id);
      explore(index + 1, runningValue + target.value, selectedIds);
      selectedIds.pop();
    }
  }

  explore(0, 0, []);
  return legalSubsets;
}

function sameTargetSet(leftIds, rightIds) {
  if (leftIds.length !== rightIds.length) {
    return false;
  }

  const left = [...leftIds].sort();
  const right = [...rightIds].sort();

  return left.every((id, index) => id === right[index]);
}

function getSelectionAnalysis(gameState, selectedCard, selectedTargetIds) {
  if (!selectedCard) {
    return {
      isValidCapture: false,
      selectedSum: 0,
      requiredSum: 0,
      selectedTargets: [],
      legalSubsets: [],
      legalTargetIds: [],
      warning: '',
      error: 'Pick a hand card first.',
    };
  }

  const targets = getVisibleTargets(gameState);
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const selectedTargets = selectedTargetIds.map((targetId) => targetMap.get(targetId)).filter(Boolean);
  const legalSubsets = findLegalCaptureSubsets(selectedCard, targets);
  const legalTargetIds = [...new Set(legalSubsets.flat())];
  const selectedSum = selectedTargets.reduce((total, target) => total + target.value, 0);
  const selectedMatchesLegalSubset = legalSubsets.some((subset) => sameTargetSet(subset, selectedTargetIds));
  const isValidCapture = selectedTargets.length > 0 && selectedSum === selectedCard.rank && selectedMatchesLegalSubset;
  const warning = legalSubsets.length > 1 ? 'Opponent may insist on all legal captures.' : '';

  return {
    isValidCapture,
    selectedSum,
    requiredSum: selectedCard.rank,
    selectedTargets,
    legalSubsets,
    legalTargetIds,
    warning,
    error: selectedTargets.length === 0 ? 'Pick a target.' : selectedSum > selectedCard.rank ? 'That goes over the card value.' : selectedSum < selectedCard.rank ? 'Selection does not add up yet.' : 'That capture is not legal.',
  };
}

function getBuildModeAnalysis(gameState, actionMode, selectedHandCard, selectedTargetIds, selectedBuildId) {
  const humanPlayer = gameState.players[0];
  const targetMap = new Map(getVisibleTargets(gameState).map((target) => [target.id, target]));
  const selectedFloorTargets = selectedTargetIds.map((targetId) => targetMap.get(targetId)).filter(Boolean);
  const selectedBuild = gameState.tableBuilds.find((build) => build.id === selectedBuildId) ?? null;
  const selectedFloorValue = selectedFloorTargets.reduce((total, target) => total + target.value, 0);
  const selectedHandValue = selectedHandCard?.rank ?? 0;

  if (actionMode === 'build-create') {
    const floorCardsOnly = selectedFloorTargets.every((target) => target.type === 'table-card');
    const targetValue = selectedFloorValue;
    const sameValueBuildExists = gameState.tableBuilds.some((build) => build.targetValue === targetValue && build.ownerId !== humanPlayer.id);
    const playerHasBuild = humanPlayer.builds.length > 0;
    const handMatchesTarget = Boolean(selectedHandCard && selectedHandCard.rank === targetValue);
    const isValid = floorCardsOnly && targetValue > 0 && handMatchesTarget && !sameValueBuildExists && !playerHasBuild;

    return {
      title: `Build ${targetValue || '?'}`,
      confirmLabel: 'Build',
      isValid,
      targetValue,
      selectedBuild,
      selectedFloorTargets,
      error: !floorCardsOnly ? 'Builds can only start from floor cards.' : !selectedHandCard ? 'Choose a matching hand card.' : !handMatchesTarget ? 'Your hand card must match the build value.' : playerHasBuild ? 'You already have a build on the table.' : sameValueBuildExists ? 'Another player already controls this build value.' : targetValue <= 0 ? 'Pick floor cards first.' : '',
      warning: '',
    };
  }

  if (actionMode === 'build-change') {
    const targetBuild = selectedBuild;
    const isSimpleOpponentBuild = Boolean(targetBuild && !targetBuild.isCompound && targetBuild.ownerId !== humanPlayer.id);
    const newTargetValue = targetBuild ? targetBuild.targetValue + selectedHandValue : 0;
    const hasClaimCard = Boolean(selectedHandCard && gameState.players[0].hand.some((card) => card.id !== selectedHandCard.id && card.rank === newTargetValue));
    const isValid = isSimpleOpponentBuild && Boolean(selectedHandCard) && hasClaimCard;

    return {
      title: targetBuild ? `Change to ${newTargetValue}` : 'Change build',
      confirmLabel: 'Change',
      isValid,
      targetValue: newTargetValue,
      selectedBuild: targetBuild,
      selectedFloorTargets,
      error: !targetBuild ? 'Select an opponent build.' : !isSimpleOpponentBuild ? 'Only a simple opponent build can be changed.' : !selectedHandCard ? 'Choose the card you want to play.' : !hasClaimCard ? 'You must also hold the new target value in hand.' : '',
      warning: 'This action cannot be combined with capturing.',
    };
  }

  if (actionMode === 'build-augment') {
    const targetBuild = selectedBuild;
    const canUseBuild = Boolean(targetBuild && targetBuild.ownerId === humanPlayer.id);
    const floorTargetsAllowed = selectedFloorTargets.every((target) => target.type === 'table-card' || target.type === 'capture-top');
    const hasOpponentPileTop = selectedFloorTargets.some((target) => target.type === 'capture-top');
    const selectedTotal = selectedFloorValue + selectedHandValue;
    const usesHandCard = Boolean(selectedHandCard);
    const isValid = canUseBuild && floorTargetsAllowed && targetBuild && selectedTotal === targetBuild.targetValue;
    const hasBaseOnFloor = selectedFloorTargets.some((target) => target.type === 'table-card') || !hasOpponentPileTop;

    return {
      title: targetBuild ? `Augment ${targetBuild.targetValue}` : 'Augment build',
      confirmLabel: 'Augment',
      isValid: isValid && hasBaseOnFloor,
      targetValue: targetBuild?.targetValue ?? 0,
      selectedBuild: targetBuild,
      selectedFloorTargets,
      error: !targetBuild ? 'Choose one of your builds.' : !canUseBuild ? 'You can only augment a build you own.' : !floorTargetsAllowed ? 'Only floor cards and opponent pile tops can be used here.' : !selectedHandCard && selectedFloorValue !== targetBuild.targetValue ? 'Add floor cards and optionally one hand card.' : selectedTotal !== targetBuild.targetValue ? 'The selected cards must total the build value.' : !hasBaseOnFloor ? 'Opponent pile cards need a floor base first.' : '',
      warning: hasOpponentPileTop ? 'Pile stealing requires a floor base.' : '',
    };
  }

  if (actionMode === 'build-stash') {
    const targetBuild = selectedBuild;
    const isOwner = Boolean(targetBuild && targetBuild.ownerId === humanPlayer.id);
    const isSimple = Boolean(targetBuild && !targetBuild.isCompound);
    const handMatches = Boolean(targetBuild && selectedHandCard && selectedHandCard.rank === targetBuild.targetValue);
    const isValid = isOwner && isSimple && handMatches;

    return {
      title: targetBuild ? `Stash ${targetBuild.targetValue}` : 'Stash build',
      confirmLabel: 'Stash',
      isValid,
      targetValue: targetBuild?.targetValue ?? 0,
      selectedBuild: targetBuild,
      selectedFloorTargets,
      error: !targetBuild ? 'Choose one of your builds.' : !isOwner ? 'You can only stash your own build.' : !isSimple ? 'Only a simple build can be stashed.' : !selectedHandCard ? 'Choose the matching card in your hand.' : !handMatches ? 'The hand card must match the build value.' : '',
      warning: 'Stash turns the build compound and adds the gold badge.',
    };
  }

  return {
    title: 'Capture',
    confirmLabel: 'Chow!',
    isValid: false,
    targetValue: 0,
    selectedBuild: null,
    selectedFloorTargets,
    error: '',
    warning: '',
  };
}

function getMoveDestinationRect(destinationRef) {
  return destinationRef.current?.getBoundingClientRect() ?? null;
}

function getCardRect(cardId, refs) {
  return refs.current.cardRefs.get(cardId)?.getBoundingClientRect() ?? null;
}

function makeFlightPath(fromRect, toRect) {
  if (!fromRect || !toRect) {
    return null;
  }

  return {
    x: toRect.left - fromRect.left,
    y: toRect.top - fromRect.top,
    width: toRect.width,
    height: toRect.height,
  };
}

function LogoMark() {
  return (
    <motion.div
      className="relative h-32 w-28 sm:h-40 sm:w-32"
      animate={{ rotate: [-2, 2, -2], y: [0, -6, 0] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.div
        className="absolute left-1 top-3 h-28 w-20 rounded-[20px] border-2 border-[#C9A84C] bg-[#f6f3ea] shadow-2xl sm:h-32 sm:w-24"
        whileHover={{ y: -6, rotate: -5, scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      >
        <div className="absolute left-2 top-2 font-mono text-xs font-bold text-[#1a1a1a]">K</div>
        <div className="absolute right-2 top-2 text-xs font-bold text-[#cc2200]">♦</div>
        <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-[#1a1a1a] sm:text-5xl">♠</div>
        <div className="absolute bottom-2 right-2 font-mono text-xs font-bold text-[#1a1a1a] rotate-180">K</div>
      </motion.div>

      <motion.div
        className="absolute left-10 top-0 h-28 w-20 rounded-[20px] border-2 border-[#C9A84C] bg-[#133e22] shadow-2xl sm:h-32 sm:w-24"
        animate={{ x: [0, 4, 0], y: [0, 4, 0] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 rounded-[18px] opacity-30" style={{ backgroundImage: 'radial-gradient(circle, rgba(201,168,76,0.8) 12%, transparent 13%)', backgroundSize: '18px 18px' }} />
      </motion.div>
    </motion.div>
  );
}

function CardFace({ card, compact = false, refCallback, draggable = false, selected = false, dragging = false, lifted = false, ariaLabel, onClick, onDragStart, onDragEnd, onDrop, onDragOver, onPointerMove, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, className = '', shimmer = false }) {
  const [tilt, setTilt] = useState(0);
  const { isSpecial, specialLabel, points } = getCardMeta(card);
  const suitColor = card.suit === '♥' || card.suit === '♦' ? '#cc2200' : '#1a1a1a';

  const handlePointerMove = (event) => {
    if (event.pointerType === 'mouse') {
      const bounds = event.currentTarget.getBoundingClientRect();
      const relativeX = (event.clientX - bounds.left) / Math.max(bounds.width, 1) - 0.5;
      setTilt(Math.max(-3, Math.min(3, relativeX * 6)));
    }

    onPointerMove?.(event);
  };

  const clearTilt = (event) => {
    setTilt(0);
    onPointerLeave?.(event);
  };

  return (
    <motion.button
      ref={refCallback}
      type="button"
      draggable={draggable}
      aria-label={ariaLabel ?? getCardAriaLabel(card)}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      onDragOver={onDragOver}
      onPointerMove={handlePointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onPointerLeave={clearTilt}
      className={`relative flex select-none rounded-[10px] border bg-white shadow-[0_10px_22px_rgba(0,0,0,0.22)] outline-none transition ${compact ? 'h-24 w-[70px]' : 'h-32 w-24'} ${selected ? 'ring-4 ring-[#C9A84C] ring-offset-2 ring-offset-transparent' : ''} ${dragging ? 'scale-110 translate-y-[-4px] rotate-3 shadow-[0_24px_36px_rgba(0,0,0,0.34)]' : ''} ${lifted ? 'scale-[1.1] -translate-y-4 rotate-[-2deg] shadow-[0_24px_36px_rgba(0,0,0,0.36)]' : ''} ${isSpecial ? 'border-[#C9A84C] shadow-[0_0_0_1px_rgba(201,168,76,0.55),0_12px_28px_rgba(0,0,0,0.24)]' : 'border-black/10'} ${className}`}
      style={{ rotate: dragging || lifted ? undefined : `${tilt}deg` }}
      whileHover={{ y: -14, scale: 1.02, boxShadow: '0 22px 38px rgba(201,168,76,0.24)' }}
      whileTap={{ scale: 0.98, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 280, damping: 20 }}
    >
      {shimmer ? <div className="absolute inset-0 rounded-[10px] bg-gradient-to-br from-[#fff9e7] via-transparent to-[#f5e5b0] opacity-45" /> : null}
      <div className="relative flex h-full w-full flex-col justify-between p-2">
        <div className="flex items-start justify-between text-[14px] font-semibold leading-none" style={{ color: suitColor }}>
          <span className="font-mono">{card.display}</span>
          <span>{card.suit}</span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className={`${compact ? 'text-3xl' : 'text-4xl'} font-semibold`} style={{ color: suitColor }}>
            {card.suit}
          </div>
        </div>
        <div className="flex items-end justify-between text-[12px] leading-none" style={{ color: suitColor }}>
          <span className="font-mono">{card.display}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.18em]">{isSpecial ? `${specialLabel} ${points}pt` : `${card.rank}`}</span>
        </div>
      </div>
    </motion.button>
  );
}

function CardBack({ compact = false, label = 'Khasino', lifted = false }) {
  return (
    <motion.div
      animate={lifted ? { scale: 1.5, y: -10, rotate: -4 } : { scale: 1, y: 0, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      className={`relative overflow-hidden rounded-[10px] border border-[#C9A84C] bg-[#123d21] shadow-[0_10px_22px_rgba(0,0,0,0.24)] ${compact ? 'h-24 w-[70px]' : 'h-32 w-24'}`}
      whileHover={{ y: -4, rotate: 2, scale: 1.02 }}
    >
      <div className="absolute inset-0 opacity-35" style={{ backgroundImage: 'radial-gradient(circle, rgba(201,168,76,0.9) 9%, transparent 10%)', backgroundSize: '18px 18px' }} />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="rounded-full border border-[#C9A84C]/70 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.28em] text-[#f6edcf]">
          {label}
        </div>
      </div>
    </motion.div>
  );
}

function PlayerChip({ name, active }) {
  return (
    <div className={`rounded-full border px-3 py-1 text-sm ${active ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#f8edc6]' : 'border-white/10 bg-white/5 text-white/80'}`}>
      {name}
    </div>
  );
}

function ToastStack({ toasts }) {
  return (
    <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-3">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: -14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-[#C9A84C]/35 bg-[#101f17]/90 px-4 py-3 text-sm text-white shadow-2xl backdrop-blur-md"
          >
            {toast.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function CardTooltip({ tooltip, onClose }) {
  if (!tooltip) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      className="fixed z-[60] max-w-[18rem] rounded-[20px] border border-[#C9A84C]/35 bg-[#101f17]/96 p-4 text-sm text-white shadow-2xl backdrop-blur-md"
      style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -110%)' }}
    >
      <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">{tooltip.title}</div>
      <div className="mt-2 font-semibold text-white">{tooltip.subtitle}</div>
      <div className="mt-3 space-y-2 text-white/78">
        {tooltip.actions.map((action) => (
          <div key={action}>• {action}</div>
        ))}
      </div>
      <button type="button" onClick={onClose} className="mt-3 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/80">
        Close
      </button>
    </motion.div>
  );
}

function GameLogDrawer({ open, onToggle, gameLog }) {
  return (
    <>
      <button
        type="button"
        onClick={onToggle}
        aria-label="Toggle game log"
        className="fixed right-4 top-28 z-40 rounded-full border border-[#C9A84C]/35 bg-[#101f17]/90 px-4 py-3 text-sm font-semibold text-[#f8edc6] shadow-2xl backdrop-blur-md"
      >
        {open ? '×' : 'Log'}
      </button>
      <motion.aside
        initial={false}
        animate={{ x: open ? 0 : '110%' }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        className="fixed right-0 top-0 z-40 h-[100dvh] w-[min(92vw,24rem)] border-l border-[#C9A84C]/25 bg-[#0f2117]/96 p-4 pt-20 shadow-2xl backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Game log</div>
            <div className="mt-1 text-lg font-semibold text-white">Last 10 actions</div>
          </div>
          <button type="button" onClick={onToggle} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/80">
            Close
          </button>
        </div>

        <div className="mt-4 space-y-2 overflow-y-auto pr-1 text-sm text-white/78">
          {gameLog.slice(0, 10).map((entry, index) => (
            <div key={`${entry}-${index}`} className="rounded-2xl border border-white/8 bg-black/10 px-3 py-3">
              {entry}
            </div>
          ))}
        </div>
      </motion.aside>
    </>
  );
}

function RulesModal({ open, onClose }) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-2xl rounded-[28px] border border-[#C9A84C]/35 bg-[#102016]/96 p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.35em] text-[#f1d79a]">Quick reference</div>
            <h2 className="mt-2 text-3xl font-bold text-white">How Khasino scores</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80">
            Got it
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {quickReferenceRows.map((row) => (
            <div key={row.action} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <div className="font-semibold text-[#f8edc6]">{row.action}</div>
              <div className="mt-2 text-sm leading-6 text-white/78">{row.description}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-[22px] border border-white/10 bg-black/10 p-4 text-sm text-white/78">
          <div className="font-semibold text-white">Scoring notes</div>
          <div className="mt-2 space-y-1">
            <div>Aces count as 1.</div>
            <div>10♦ is special.</div>
            <div>2♠ is special.</div>
            <div>Top capture cards stay visible.</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SetupScreen({ gameState, setGameState, startGame }) {
  const playerNamesList = useMemo(() => playerNames.slice(0, gameState.playerCount), [gameState.playerCount]);

  const selectPlayerCount = (count) => {
    setGameState((previousState) => ({
      ...createInitialGameState(count, count === 2 ? previousState.dealRound : 1),
      phase: 'setup',
      playerCount: count,
      dealRound: count === 2 ? previousState.dealRound : 1,
    }));
  };

  const selectDealRound = (dealRound) => {
    setGameState((previousState) => ({
      ...previousState,
      dealRound,
      phase: 'setup',
    }));
  };

  return (
    <motion.section
      key="setup"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className="grid w-full gap-8 lg:grid-cols-[1.08fr_0.92fr]"
    >
      <div className="rounded-[32px] border border-[#C9A84C]/35 bg-black/15 p-6 shadow-2xl backdrop-blur-md sm:p-8 lg:p-10">
        <div className="flex flex-col gap-8">
          <div className="flex items-start gap-5">
            <LogoMark />
            <div className="pt-3">
              <div className="mb-2 text-xs uppercase tracking-[0.4em] text-[#f1d79a]">Township Night</div>
              <h1 className="khasino-font text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">Khasino</h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-white/78 sm:text-base">
                South African Casino with the first human turn tools wired in. Choose the table size, then step into the felt.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[2, 3, 4].map((count) => (
              <motion.button
                key={count}
                type="button"
                onClick={() => selectPlayerCount(count)}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                className={`rounded-[18px] border px-4 py-4 text-left transition ${gameState.playerCount === count ? 'border-[#C9A84C] bg-[#C9A84C]/15 shadow-[0_0_0_1px_rgba(201,168,76,0.35)]' : 'border-white/10 bg-white/5'}`}
              >
                <div className="khasino-font text-2xl font-bold">{count}</div>
                <div className="mt-1 text-sm text-white/75">Players</div>
              </motion.button>
            ))}
          </div>

          {gameState.playerCount === 2 ? (
            <div className="flex flex-wrap gap-3">
              {[1, 2].map((dealRound) => (
                <motion.button
                  key={dealRound}
                  type="button"
                  onClick={() => selectDealRound(dealRound)}
                  whileHover={{ y: -2, scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold ${gameState.dealRound === dealRound ? 'border-[#C9A84C] bg-[#C9A84C] text-[#1b241b]' : 'border-white/10 bg-white/5 text-white/80'}`}
                >
                  {dealRound === 1 ? 'First deal' : 'Second deal'}
                </motion.button>
              ))}
              <div className="flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">
                {gameState.dealRound === 1 ? 'Drifting is locked if you own a build.' : 'Drifting stays open even with a build.'}
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <motion.button
              type="button"
              onClick={startGame}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="rounded-full border border-[#C9A84C] bg-[#C9A84C] px-6 py-3 font-semibold text-[#1b241b] shadow-[0_12px_30px_rgba(0,0,0,0.28)]"
            >
              Start table
            </motion.button>
            <div className="flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              Placeholder names: {playerNamesList.join(', ')}
            </div>
          </div>

          <div className="grid gap-3 rounded-[24px] border border-white/10 bg-black/10 p-4 sm:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Deck</div>
              <p className="mt-2 text-sm text-white/80">40 cards, Ace through 10, no face cards.</p>
            </div>
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Special cards</div>
              <p className="mt-2 text-sm text-white/80">10♦ = Mummy, 2♠ = Spy Two, all Aces score as 1.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[32px] border border-[#C9A84C]/30 bg-[#153d22]/85 p-6 shadow-2xl backdrop-blur-md sm:p-8 lg:p-10">
        <div className="flex h-full flex-col justify-between gap-6">
          <div>
            <div className="khasino-font text-3xl font-bold text-white sm:text-4xl">Setup state</div>
            <p className="mt-3 max-w-md text-sm leading-6 text-white/72">
              The game state is wired for the future table flow, and the play screen now accepts human turn input.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
              <div className="text-xs uppercase tracking-[0.32em] text-[#f1d79a]">Players</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {playerNamesList.map((name, index) => (
                  <PlayerChip key={name} name={name} active={index === 0} />
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-black/15 p-4">
              <div className="text-xs uppercase tracking-[0.32em] text-[#f1d79a]">State shape</div>
              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-white/75">
{JSON.stringify(
  {
    phase: gameState.phase,
    playerCount: gameState.playerCount,
    currentPlayerIndex: gameState.currentPlayerIndex,
    dealRound: gameState.dealRound,
    tableCards: gameState.tableCards.length,
    tableBuilds: gameState.tableBuilds.length,
    deck: gameState.deck.length,
  },
  null,
  2,
)}
              </pre>
            </div>
          </div>

          <motion.div
            className="rounded-[28px] border border-[#C9A84C]/25 bg-[#0f2416] p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Table preview</div>
                <div className="mt-1 text-sm text-white/72">Visual only, no dealing or play logic yet.</div>
              </div>
              <div className="flex gap-2">
                <CardBack compact />
                <CardFace card={makeCard(10, '♦', 'demo-10-d')} compact shimmer />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
}

function TargetZone({ target, activeCard, hoveredTargetId, selectedTargetIds, selectedBuildId, targetStatus, onClick, onDragOver, onDrop, onPointerDown, onPointerUp, registerRef, renderBody, ariaLabel }) {
  const isHovered = hoveredTargetId === target.id;
  const isSelected = selectedTargetIds.includes(target.id) || (target.type === 'build' && selectedBuildId === target.buildId);
  const isLegal = targetStatus[target.id]?.isLegal;
  const toneClass = activeCard ? (isLegal ? 'border-[#C9A84C] bg-[#C9A84C]/12' : 'border-red-400/40 bg-red-500/10') : 'border-white/10 bg-white/5';
  const buildGlowStyle = target.type === 'build' && target.ownerColor ? { boxShadow: `0 0 0 1px ${target.ownerColor}66, 0 0 20px ${target.ownerColor}33` } : undefined;

  return (
    <motion.button
      ref={registerRef(target.id)}
      type="button"
      aria-label={ariaLabel ?? `${target.label}. ${target.type === 'build' ? 'Build target' : 'Table target'}`}
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      whileHover={{ y: -3, scale: 1.01 }}
      style={buildGlowStyle}
      className={`relative rounded-2xl border p-2 text-left transition ${toneClass} ${isSelected ? 'ring-4 ring-[#C9A84C] ring-offset-2 ring-offset-transparent' : ''} ${isHovered && activeCard ? (isLegal ? 'shadow-[0_0_0_1px_rgba(201,168,76,0.5)]' : 'shadow-[0_0_0_1px_rgba(248,113,113,0.5)]') : ''}`}
    >
      {renderBody()}
    </motion.button>
  );
}

function HumanHand({ player, selectedHandCardId, draggingHandCardId, selectedTargetIds, setSelectedHandCardId, setSelectedTargetIds, setDraggingHandCardId, registerCardRef, onCardDragStart, onCardDragEnd, onCardDrop, onCardDragOver, onSelectTarget, onCardPointerDown, onCardPointerMove, onCardPointerUp }) {
  return (
    <div className="flex flex-nowrap gap-3 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-visible">
      {player.hand.length > 0 ? (
        player.hand.map((card) => (
          <CardFace
            key={card.id}
            card={card}
            refCallback={registerCardRef(card.id)}
            draggable
            selected={selectedHandCardId === card.id}
            dragging={draggingHandCardId === card.id}
            className={`${selectedHandCardId === card.id ? '-translate-y-3' : draggingHandCardId && draggingHandCardId !== card.id ? 'translate-y-2' : ''}`}
            ariaLabel={getCardAriaLabel(card, ['select', 'drag', 'swipe up to drift'])}
            onClick={() => {
              setSelectedHandCardId(card.id);
              setSelectedTargetIds([]);
            }}
            onDragStart={(event) => onCardDragStart(event, card)}
            onDragEnd={() => onCardDragEnd()}
            onDrop={(event) => onCardDrop(event, card)}
            onDragOver={onCardDragOver}
            onPointerMove={(event) => {
              onSelectTarget(event);
              onCardPointerMove?.(card, event);
            }}
            onPointerDown={(event) => onCardPointerDown?.(card, event)}
            onPointerUp={(event) => onCardPointerUp?.(card, event)}
            onPointerCancel={(event) => onCardPointerUp?.(card, event)}
          />
        ))
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/70">Hand is empty.</div>
      )}
    </div>
  );
}

function PlayingScreen({ gameState, setGameState, pushToast, onBackToSetup, onToggleLogDrawer, onOpenRules }) {
  const boardRefs = useRef({ cardRefs: new Map(), zoneRefs: new Map(), driftRef: null, capturePileRef: null, tableSurfaceRef: null });
  const animationTimeoutRef = useRef(null);
  const gameStateRef = useRef(gameState);
  const cpuThinkingTimeoutRef = useRef(null);
  const cpuLiftTimeoutRef = useRef(null);
  const cpuTurnInProgressRef = useRef(false);
  const handGestureRef = useRef(null);
  const targetPressTimeoutRef = useRef(null);
  const tablePinchRef = useRef({ startDistance: 0, startZoom: 1 });

  const [actionMode, setActionMode] = useState('capture');
  const [selectedHandCardId, setSelectedHandCardId] = useState(null);
  const [selectedTargetIds, setSelectedTargetIds] = useState([]);
  const [selectedBuildId, setSelectedBuildId] = useState(null);
  const [draggingHandCardId, setDraggingHandCardId] = useState(null);
  const [cpuThinkingPlayerIndex, setCpuThinkingPlayerIndex] = useState(null);
  const [cpuLiftedCardId, setCpuLiftedCardId] = useState(null);
  const [hoveredTargetId, setHoveredTargetId] = useState(null);
  const [cursor, setCursor] = useState({ x: 0, y: 0 });
  const [cardTooltip, setCardTooltip] = useState(null);
  const [tableZoom, setTableZoom] = useState(1);
  const [shakeNonce, setShakeNonce] = useState(0);
  const [moveAnimations, setMoveAnimations] = useState([]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  const selectedHandCard = gameState.players[0].hand.find((card) => card.id === selectedHandCardId) ?? null;
  const visibleTargets = useMemo(() => getVisibleTargets(gameState), [gameState]);
  const targetStatus = useMemo(() => {
    const status = {};

    visibleTargets.forEach((target) => {
      status[target.id] = { isLegal: false };
    });

    if (!selectedHandCard) {
      return status;
    }

    if (actionMode === 'capture') {
      const legalSubsets = findLegalCaptureSubsets(selectedHandCard, visibleTargets);

      visibleTargets.forEach((target) => {
        status[target.id] = { isLegal: legalSubsets.some((subset) => subset.includes(target.id)) };
      });

      return status;
    }

    if (actionMode === 'build-create') {
      visibleTargets.forEach((target) => {
        status[target.id] = { isLegal: target.type === 'table-card' };
      });

      return status;
    }

    if (actionMode === 'build-augment') {
      visibleTargets.forEach((target) => {
        status[target.id] = { isLegal: target.type === 'table-card' || target.type === 'capture-top' || (target.type === 'build' && target.buildId === selectedBuildId) };
      });

      return status;
    }

    if (actionMode === 'build-change' || actionMode === 'build-stash') {
      visibleTargets.forEach((target) => {
        status[target.id] = { isLegal: target.type === 'build' };
      });
    }

    return status;
  }, [actionMode, selectedBuildId, selectedHandCard, visibleTargets]);

  const selectionAnalysis = useMemo(() => getSelectionAnalysis(gameState, selectedHandCard, selectedTargetIds), [gameState, selectedHandCard, selectedTargetIds]);
  const buildAnalysis = useMemo(
    () => getBuildModeAnalysis(gameState, actionMode, selectedHandCard, selectedTargetIds, selectedBuildId),
    [gameState, actionMode, selectedHandCard, selectedTargetIds, selectedBuildId],
  );
  const canDrift = useMemo(() => {
    const humanOwnsBuild = gameState.players[0]?.builds?.length > 0;
    const isFirstDealTwoPlayer = gameState.playerCount === 2 && gameState.dealRound === 1;

    return !(humanOwnsBuild && isFirstDealTwoPlayer);
  }, [gameState.playerCount, gameState.dealRound, gameState.players]);
  const activePlayer = gameState.players[gameState.currentPlayerIndex] ?? gameState.players[0];
  const isHumanTurn = activePlayer?.isHuman ?? true;
  const controlsDisabled = !isHumanTurn || cpuThinkingPlayerIndex !== null;

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }

      if (targetPressTimeoutRef.current) {
        window.clearTimeout(targetPressTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (gameState.phase !== 'playing') {
      cpuTurnInProgressRef.current = false;
      setCpuThinkingPlayerIndex(null);
      setCpuLiftedCardId(null);
      return;
    }

    if (isHumanTurn) {
      cpuTurnInProgressRef.current = false;
      setCpuThinkingPlayerIndex(null);
      setCpuLiftedCardId(null);
      if (cpuThinkingTimeoutRef.current) {
        window.clearTimeout(cpuThinkingTimeoutRef.current);
      }
      if (cpuLiftTimeoutRef.current) {
        window.clearTimeout(cpuLiftTimeoutRef.current);
      }
      return;
    }

    if (cpuTurnInProgressRef.current) {
      return;
    }

    cpuTurnInProgressRef.current = true;
    setCpuThinkingPlayerIndex(gameState.currentPlayerIndex);
    setSelectedHandCardId(null);
    setSelectedTargetIds([]);
    setSelectedBuildId(null);

    cpuThinkingTimeoutRef.current = window.setTimeout(() => {
      const snapshot = gameStateRef.current;
      const cpuIndex = snapshot.currentPlayerIndex;
      const move = chooseCpuMove(snapshot, cpuIndex);

      if (!move) {
        setGameState((previousState) => ({
          ...previousState,
          currentPlayerIndex: getNextPlayerIndex(previousState, cpuIndex),
        }));
        setCpuThinkingPlayerIndex(null);
        setCpuLiftedCardId(null);
        cpuTurnInProgressRef.current = false;
        return;
      }

      setCpuLiftedCardId(move.card?.id ?? null);

      cpuLiftTimeoutRef.current = window.setTimeout(() => {
        const currentSnapshot = gameStateRef.current;
        const resolvedMove = chooseCpuMove(currentSnapshot, cpuIndex) ?? move;
        const nextState = applyCpuMoveState(currentSnapshot, cpuIndex, resolvedMove);

        setGameState(nextState);
        pushToast(describeCpuMove(currentSnapshot, cpuIndex, resolvedMove));
        setCpuThinkingPlayerIndex(null);
        setCpuLiftedCardId(null);
        cpuTurnInProgressRef.current = false;
      }, 400);
    }, 600);

    return () => {
      if (cpuThinkingTimeoutRef.current) {
        window.clearTimeout(cpuThinkingTimeoutRef.current);
      }

      if (cpuLiftTimeoutRef.current) {
        window.clearTimeout(cpuLiftTimeoutRef.current);
      }
    };
  }, [gameState.phase, gameState.currentPlayerIndex, isHumanTurn, pushToast, setGameState]);

  const clearSelection = () => {
    setSelectedHandCardId(null);
    setSelectedTargetIds([]);
    setSelectedBuildId(null);
    setHoveredTargetId(null);
    clearTooltip();
  };

  const registerCardRef = (cardId) => (element) => {
    const cardRefs = boardRefs.current.cardRefs;
    if (element) {
      cardRefs.set(cardId, element);
      return;
    }

    cardRefs.delete(cardId);
  };

  const registerZoneRef = (zoneId) => (element) => {
    const zoneRefs = boardRefs.current.zoneRefs;
    if (element) {
      zoneRefs.set(zoneId, element);
      return;
    }

    zoneRefs.delete(zoneId);
  };

  const setDriftRef = (element) => {
    boardRefs.current.driftRef = element;
  };

  const setCapturePileRef = (element) => {
    boardRefs.current.capturePileRef = element;
  };

  const setTableSurfaceRef = (element) => {
    boardRefs.current.tableSurfaceRef = element;
  };

  const addMoveAnimations = (items) => {
    setMoveAnimations(items);

    if (animationTimeoutRef.current) {
      window.clearTimeout(animationTimeoutRef.current);
    }

    animationTimeoutRef.current = window.setTimeout(() => {
      setMoveAnimations([]);
    }, 900);
  };

  const updateGameState = (updater) => {
    setGameState((previousState) => updater(previousState));
  };

  const selectHandCard = (cardId) => {
    setSelectedHandCardId(cardId);
    setSelectedTargetIds([]);
    setHoveredTargetId(null);
  };

  const setMode = (nextMode) => {
    setActionMode(nextMode);
    setSelectedTargetIds([]);
    setSelectedBuildId(null);
    setHoveredTargetId(null);
  };

  const toggleTarget = (targetId) => {
    setSelectedTargetIds((previousIds) => {
      if (previousIds.includes(targetId)) {
        return previousIds.filter((id) => id !== targetId);
      }

      return [...previousIds, targetId];
    });
  };

  const playDrift = (card, destinationRect) => {
    if (!canDrift) {
      pushToast('Drift is locked on the first 2-player deal while you own a build.');
      setShakeNonce((value) => value + 1);
      return;
    }

    const fromRect = getCardRect(card.id, boardRefs);
    const toRect = destinationRect ?? getMoveDestinationRect({ current: boardRefs.current.driftRef }) ?? boardRefs.current.tableSurfaceRef?.getBoundingClientRect();

    if (fromRect && toRect) {
      addMoveAnimations([
        {
          id: `drift-${card.id}`,
          card,
          fromRect,
          toRect,
          delay: 0,
        },
      ]);
    }

    updateGameState((previousState) => ({
      ...previousState,
      players: previousState.players.map((player) =>
        player.id === previousState.players[0].id
          ? {
              ...player,
              hand: player.hand.filter((handCard) => handCard.id !== card.id),
            }
          : player,
      ),
      tableCards: [...previousState.tableCards, card],
      currentPlayerIndex: getNextPlayerIndex(previousState),
      gameLog: [`Drifted ${describeCard(card)}`, ...previousState.gameLog].slice(0, 10),
      lastCapturePlayerId: previousState.players[0].id,
    }));

    pushToast(`Drifted ${describeCard(card)}`);
    clearSelection();
  };

  const applyBuildCreate = () => {
    const selectedFloorTargets = selectedTargetIds
      .map((targetId) => getVisibleTargets(gameState).find((target) => target.id === targetId))
      .filter(Boolean);
    const buildCards = sortAscendingCards(selectedFloorTargets.flatMap((target) => target.cards));
    const targetValue = buildCards.reduce((total, card) => total + card.rank, 0);
    const buildId = `build-${Date.now()}`;
    const ownerId = gameState.players[0].id;
    const ownerName = gameState.players[0].name;
    const ownerColor = getBuildOwnershipColor(ownerId);
    const topCard = buildCards[0] ?? selectedHandCard;

    updateGameState((previousState) => ({
      ...previousState,
      players: previousState.players.map((player) =>
        player.id === ownerId
          ? {
              ...player,
              hand: player.hand.filter((card) => card.id !== selectedHandCard.id),
              builds: [
                ...player.builds,
                {
                  id: buildId,
                  cards: buildCards,
                  targetValue,
                  ownerId,
                  ownerName,
                  ownerColor,
                  isCompound: false,
                  stashed: false,
                  topCard,
                },
              ],
            }
          : player,
      ),
      tableCards: previousState.tableCards.filter((card) => !selectedTargetIds.includes(`table-${card.id}`)),
      tableBuilds: [
        ...previousState.tableBuilds,
        {
          id: buildId,
          cards: buildCards,
          targetValue,
          ownerId,
          ownerName,
          ownerColor,
          isCompound: false,
          stashed: false,
          topCard,
        },
      ],
      currentPlayerIndex: getNextPlayerIndex(previousState),
      gameLog: [`Built ${targetValue} from ${describeCards(buildCards)}`, ...previousState.gameLog].slice(0, 10),
    }));

    const pileRect = boardRefs.current.tableSurfaceRef?.getBoundingClientRect();
    const handRect = getCardRect(selectedHandCard.id, boardRefs);

    if (handRect && pileRect) {
      addMoveAnimations([
        { id: `build-create-hand-${selectedHandCard.id}`, card: selectedHandCard, fromRect: handRect, toRect: pileRect, delay: 0.04 },
        ...selectedFloorTargets.flatMap((target, index) =>
          target.cards.map((card, cardIndex) => ({
            id: `build-create-floor-${target.id}-${card.id}`,
            card,
            fromRect: boardRefs.current.zoneRefs.get(target.id)?.getBoundingClientRect() ?? pileRect,
            toRect: pileRect,
            delay: 0.06 * (index + cardIndex + 1),
          })),
        ),
      ]);
    }

    pushToast(`Build ${targetValue}?`);
    clearSelection();
  };

  const applyBuildChange = () => {
    const targetBuild = gameState.tableBuilds.find((build) => build.id === selectedBuildId);

    if (!targetBuild) {
      return;
    }

    const newTargetValue = targetBuild.targetValue + selectedHandCard.rank;
    const claimCard = gameState.players[0].hand.find((card) => card.id !== selectedHandCard.id && card.rank === newTargetValue);
    const currentPlayerId = gameState.players[0].id;
    const currentPlayerName = gameState.players[0].name;
    const ownerColor = getBuildOwnershipColor(currentPlayerId);

    updateGameState((previousState) => ({
      ...previousState,
      tableBuilds: previousState.tableBuilds.map((build) =>
        build.id === targetBuild.id
          ? {
              ...build,
              cards: [...build.cards, selectedHandCard],
              targetValue: newTargetValue,
              ownerId: currentPlayerId,
              ownerName: currentPlayerName,
              ownerColor,
              topCard: selectedHandCard,
              isCompound: false,
            }
          : build,
      ),
      players: previousState.players.map((player) => {
        if (player.id === currentPlayerId) {
          return {
            ...player,
            hand: player.hand.filter((card) => card.id !== selectedHandCard.id),
            builds: player.builds.map((build) =>
              build.id === targetBuild.id
                ? {
                    ...build,
                    cards: [...build.cards, selectedHandCard],
                    targetValue: newTargetValue,
                    ownerId: currentPlayerId,
                    ownerName: currentPlayerName,
                    ownerColor,
                    topCard: selectedHandCard,
                    isCompound: false,
                  }
                : build,
            ),
          };
        }

        if (player.id === targetBuild.ownerId) {
          return {
            ...player,
            builds: player.builds.map((build) =>
              build.id === targetBuild.id
                ? {
                    ...build,
                    cards: [...build.cards, selectedHandCard],
                    targetValue: newTargetValue,
                    ownerId: currentPlayerId,
                    ownerName: currentPlayerName,
                    ownerColor,
                    topCard: selectedHandCard,
                    isCompound: false,
                  }
                : build,
            ),
          };
        }

        return player;
      }),
      currentPlayerIndex: getNextPlayerIndex(previousState),
      gameLog: [`Changed build to ${newTargetValue} with ${describeCard(selectedHandCard)}`, ...previousState.gameLog].slice(0, 10),
    }));

    pushToast(`Build changed to ${newTargetValue}.`);
    clearSelection();
  };

  const applyBuildAugment = () => {
    const targetBuild = gameState.tableBuilds.find((build) => build.id === selectedBuildId);

    if (!targetBuild) {
      return;
    }

    const selectedTargets = getVisibleTargets(gameState).filter((target) => selectedTargetIds.includes(target.id));
    const augmentCards = [...selectedTargets.flatMap((target) => target.cards)];

    if (selectedHandCard) {
      augmentCards.push(selectedHandCard);
    }

    const sortedAugments = sortAscendingCards(augmentCards);
    const targetRect = boardRefs.current.zoneRefs.get(`build-${targetBuild.id}`)?.getBoundingClientRect() ?? boardRefs.current.tableSurfaceRef?.getBoundingClientRect();
    const flightItems = sortedAugments.map((card, index) => ({
      id: `augment-${targetBuild.id}-${card.id}`,
      card,
      fromRect: getCardRect(card.id, boardRefs) ?? boardRefs.current.zoneRefs.get(`build-${targetBuild.id}`)?.getBoundingClientRect(),
      toRect: targetRect,
      delay: index * 0.07,
    }));

    addMoveAnimations(flightItems.filter((item) => item.fromRect && item.toRect));

    updateGameState((previousState) => ({
      ...previousState,
      players: previousState.players.map((player) => {
        if (player.id === previousState.players[0].id) {
          return {
            ...player,
            hand: selectedHandCard ? player.hand.filter((card) => card.id !== selectedHandCard.id) : player.hand,
            builds: player.builds.map((build) =>
              build.id === targetBuild.id
                ? {
                    ...build,
                    cards: sortAscendingCards([...build.cards, ...augmentCards]),
                    isCompound: true,
                    stashed: false,
                    topCard: augmentCards[augmentCards.length - 1] ?? build.topCard,
                  }
                : build,
            ),
                        currentPlayerIndex: getNextPlayerIndex(previousState),
          };
        }

        if (selectedTargetIds.includes(`capture-${player.id}`)) {
          return {
            ...player,
            capturePile: player.capturePile.slice(1),
          };
        }

        return player;
      }),
      tableCards: previousState.tableCards.filter((card) => !selectedTargetIds.includes(`table-${card.id}`)),
      tableBuilds: previousState.tableBuilds.map((build) =>
        build.id === targetBuild.id
          ? {
              ...build,
              cards: sortAscendingCards([...build.cards, ...augmentCards]),
              isCompound: true,
              stashed: false,
              topCard: augmentCards[augmentCards.length - 1] ?? build.topCard,
            }
          : build,
      ),
      gameLog: [`Augmented build ${targetBuild.targetValue}`, ...previousState.gameLog].slice(0, 10),
    }));

    pushToast(`Augmented build ${targetBuild.targetValue}.`);
    clearSelection();
  };

  const applyBuildStash = () => {
    const targetBuild = gameState.tableBuilds.find((build) => build.id === selectedBuildId);

    if (!targetBuild || !selectedHandCard) {
      return;
    }

    updateGameState((previousState) => ({
      ...previousState,
      players: previousState.players.map((player) =>
        player.id === previousState.players[0].id
          ? {
              ...player,
              hand: player.hand.filter((card) => card.id !== selectedHandCard.id),
              builds: player.builds.map((build) =>
                build.id === targetBuild.id
                  ? {
                      ...build,
                      cards: sortAscendingCards([...build.cards, selectedHandCard]),
                      isCompound: true,
                      stashed: true,
                      topCard: selectedHandCard,
                    }
                  : build,
              ),
            }
          : player,
      ),
      tableBuilds: previousState.tableBuilds.map((build) =>
        build.id === targetBuild.id
          ? {
              ...build,
              cards: sortAscendingCards([...build.cards, selectedHandCard]),
              isCompound: true,
              stashed: true,
              topCard: selectedHandCard,
            }
          : build,
      ),
        currentPlayerIndex: getNextPlayerIndex(previousState),
      gameLog: [`Stashed ${describeCard(selectedHandCard)} on build ${targetBuild.targetValue}` , ...previousState.gameLog].slice(0, 10),
    }));

    pushToast(`Stashed ${describeCard(selectedHandCard)}.`);
    clearSelection();
  };

  const confirmBuildAction = () => {
    if (!selectedHandCard) {
      setShakeNonce((value) => value + 1);
      pushToast('Pick a hand card first.');
      return;
    }

    if (!buildAnalysis.isValid) {
      setShakeNonce((value) => value + 1);
      pushToast(buildAnalysis.error || 'That build is not legal.');
      return;
    }

    if (actionMode === 'build-create') {
      applyBuildCreate();
      return;
    }

    if (actionMode === 'build-change') {
      applyBuildChange();
      return;
    }

    if (actionMode === 'build-augment') {
      applyBuildAugment();
      return;
    }

    if (actionMode === 'build-stash') {
      applyBuildStash();
    }
  };

  const applyCapture = (card, targetIds) => {
    const selectedTargets = getVisibleTargets(gameState).filter((target) => targetIds.includes(target.id));
    const selectedTargetRects = selectedTargets
      .map((target) => {
        const element = boardRefs.current.zoneRefs.get(target.id);
        return element ? { target, rect: element.getBoundingClientRect() } : null;
      })
      .filter(Boolean);
    const pileRect = boardRefs.current.capturePileRef?.getBoundingClientRect() ?? boardRefs.current.tableSurfaceRef?.getBoundingClientRect();
    const handRect = getCardRect(card.id, boardRefs);

    const capturedCards = sortAscendingCards([
      card,
      ...selectedTargets.flatMap((target) => target.cards),
    ]);

    if (handRect && pileRect) {
      const animationItems = [
        {
          id: `played-${card.id}`,
          card,
          fromRect: handRect,
          toRect: pileRect,
          delay: 0.05,
        },
        ...selectedTargetRects.flatMap((entry, index) =>
          entry.target.cards.map((capturedCard, cardIndex) => ({
            id: `${entry.target.id}-${capturedCard.id}`,
            card: capturedCard,
            fromRect: entry.rect,
            toRect: pileRect,
            delay: 0.08 * (index + cardIndex + 1),
          })),
        ),
      ];

      addMoveAnimations(animationItems);
    }

    updateGameState((previousState) => {
      const humanId = previousState.players[0].id;
      const targetIdSet = new Set(targetIds);
      const removedBuildIds = new Set();
      const removedPileCardIds = new Set();

      const nextPlayers = previousState.players.map((player, index) => {
        if (index === 0) {
          return {
            ...player,
            hand: player.hand.filter((handCard) => handCard.id !== card.id),
            capturePile: [...capturedCards, ...player.capturePile],
          };
        }

        const nextBuilds = player.builds.filter((build) => {
          const buildTargetId = `build-${build.id}`;
          if (targetIdSet.has(buildTargetId)) {
            removedBuildIds.add(build.id);
            return false;
          }

          return true;
        });

        const topCard = player.capturePile[0];
        if (topCard && targetIdSet.has(`capture-${player.id}`)) {
          removedPileCardIds.add(topCard.id);
        }

        const nextCapturePile = targetIdSet.has(`capture-${player.id}`) ? player.capturePile.slice(1) : player.capturePile;

        return {
          ...player,
          builds: nextBuilds,
          capturePile: nextCapturePile,
        };
      });

      const nextTableCards = previousState.tableCards.filter((tableCard) => !targetIdSet.has(`table-${tableCard.id}`));
      const nextTableBuilds = previousState.tableBuilds.filter((build) => !targetIdSet.has(`build-${build.id}`));

      nextPlayers.forEach((player) => {
        if (player.id === humanId) {
          return;
        }

        player.builds = player.builds.filter((build) => !removedBuildIds.has(build.id));
        player.capturePile = player.capturePile.filter((captureCard) => !removedPileCardIds.has(captureCard.id));
      });

      return {
        ...previousState,
        players: nextPlayers,
        tableCards: nextTableCards,
        tableBuilds: nextTableBuilds,
        currentPlayerIndex: getNextPlayerIndex(previousState),
        lastCapturePlayerId: humanId,
        gameLog: [`Chowed! ${describeCards(capturedCards)} with ${describeCard(card)}`, ...previousState.gameLog].slice(0, 10),
      };
    });

    pushToast(`Chowed! ${describeCards(selectedTargets.flatMap((target) => target.cards))} with ${describeCard(card)}`);
    clearSelection();
  };

  const attemptConfirmCapture = () => {
    if (!selectedHandCard) {
      setShakeNonce((value) => value + 1);
      pushToast('Pick a hand card first.');
      return;
    }

    if (!selectionAnalysis.isValidCapture) {
      setShakeNonce((value) => value + 1);
      pushToast(selectionAnalysis.error);
      return;
    }

    applyCapture(selectedHandCard, selectedTargetIds);
  };

  const handleTargetClick = (target) => {
    if (!selectedHandCard) {
      return;
    }

    if (actionMode === 'capture') {
      toggleTarget(target.id);
      return;
    }

    if (actionMode === 'build-create' && target.type === 'table-card') {
      toggleTarget(target.id);
      return;
    }

    if (actionMode === 'build-augment' && (target.type === 'table-card' || target.type === 'capture-top')) {
      toggleTarget(target.id);
      return;
    }

    if ((actionMode === 'build-change' || actionMode === 'build-stash' || actionMode === 'build-augment') && target.type === 'build') {
      setSelectedBuildId(target.buildId);
      return;
    }
  };

  const handleDriftClick = () => {
    if (actionMode !== 'capture' || !selectedHandCard) {
      return;
    }

    setSelectedTargetIds([]);
    playDrift(selectedHandCard);
  };

  const handleTargetDrop = (target) => {
    if (!selectedHandCard) {
      return;
    }

    if (actionMode !== 'capture' && target.id === 'table-drift-zone') {
      return;
    }

    if (actionMode === 'build-create' && target.type === 'table-card') {
      toggleTarget(target.id);
      return;
    }

    if (actionMode === 'build-augment' && (target.type === 'table-card' || target.type === 'capture-top')) {
      toggleTarget(target.id);
      return;
    }

    if ((actionMode === 'build-change' || actionMode === 'build-stash' || actionMode === 'build-augment') && target.type === 'build') {
      setSelectedBuildId(target.buildId);
      return;
    }

    if (actionMode !== 'capture') {
      return;
    }

    setSelectedTargetIds((previousIds) => {
      const nextIds = previousIds.includes(target.id) ? previousIds.filter((id) => id !== target.id) : [...previousIds, target.id];
      const nextAnalysis = getSelectionAnalysis(gameState, selectedHandCard, nextIds);

      if (target.id === 'table-drift-zone') {
        if (canDrift) {
          playDrift(selectedHandCard);
        } else {
          setShakeNonce((value) => value + 1);
          pushToast('Drift is locked on this deal.');
        }

        return [];
      }

      if (nextAnalysis.isValidCapture) {
        applyCapture(selectedHandCard, nextIds);
        return [];
      }

      return nextIds;
    });
  };

  const handleCardDragStart = (event, card) => {
    setDraggingHandCardId(card.id);
    selectHandCard(card.id);

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
    }
  };

  const handleCardDragEnd = () => {
    setDraggingHandCardId(null);
    setHoveredTargetId(null);
  };

  const handlePointerMove = (event) => {
    setCursor({ x: event.clientX, y: event.clientY });
  };

  const clearTooltip = () => {
    if (targetPressTimeoutRef.current) {
      window.clearTimeout(targetPressTimeoutRef.current);
      targetPressTimeoutRef.current = null;
    }

    setCardTooltip(null);
  };

  const openTargetTooltip = (target, anchorEvent) => {
    const legal = targetStatus[target.id]?.isLegal;
    const actionText = [];

    if (target.type === 'table-card') {
      actionText.push(legal ? 'Can be targeted for chow or build floor.' : 'Not legal with the current hand card.');
    }

    if (target.type === 'build') {
      actionText.push(legal ? 'Can be changed, augmented, or stashed.' : 'Select a hand card to inspect legal build actions.');
    }

    if (target.type === 'capture-top') {
      actionText.push(legal ? 'Can be augmented or captured in some builds.' : 'A capture pile top is currently visible here.');
    }

    setCardTooltip({
      title: target.label,
      subtitle: target.type === 'build' ? `Target ${target.value}` : describeCards(target.cards),
      actions: actionText,
      x: anchorEvent.clientX,
      y: anchorEvent.clientY,
    });
  };

  const handleTargetPressStart = (target, event) => {
    if (event.pointerType === 'mouse') {
      return;
    }

    clearTooltip();
    targetPressTimeoutRef.current = window.setTimeout(() => openTargetTooltip(target, event), 380);
  };

  const handleTargetPressEnd = () => {
    clearTooltip();
  };

  const handleHandCardPointerDown = (card, event) => {
    if (event.pointerType !== 'touch') {
      return;
    }

    handGestureRef.current = {
      cardId: card.id,
      startX: event.clientX,
      startY: event.clientY,
      active: true,
    };
    selectHandCard(card.id);
  };

  const handleHandCardPointerMove = (card, event) => {
    const gesture = handGestureRef.current;

    if (!gesture || gesture.cardId !== card.id || !gesture.active) {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (deltaY < -70 && Math.abs(deltaX) < 70) {
      gesture.active = false;
      selectHandCard(card.id);
      playDrift(card);
    }
  };

  const handleHandCardPointerUp = () => {
    handGestureRef.current = null;
  };

  const handleTableTouchStart = (event) => {
    if (event.touches.length !== 2) {
      return;
    }

    const [firstTouch, secondTouch] = event.touches;
    const distance = Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);

    tablePinchRef.current = { startDistance: distance, startZoom: tableZoom };
  };

  const handleTableTouchMove = (event) => {
    if (event.touches.length !== 2 || !tablePinchRef.current.startDistance) {
      return;
    }

    const [firstTouch, secondTouch] = event.touches;
    const distance = Math.hypot(secondTouch.clientX - firstTouch.clientX, secondTouch.clientY - firstTouch.clientY);
    const nextZoom = Math.max(0.85, Math.min(1.25, tablePinchRef.current.startZoom * (distance / tablePinchRef.current.startDistance)));

    setTableZoom(nextZoom);
  };

  const handleTableTouchEnd = (event) => {
    if (event.touches.length < 2) {
      tablePinchRef.current.startDistance = 0;
    }
  };

  const activeCard = selectedHandCard;

  const targetDropStatus = useMemo(() => {
    const status = {};

    visibleTargets.forEach((target) => {
      status[target.id] = {
        isLegal: activeCard ? targetStatus[target.id]?.isLegal ?? false : false,
      };
    });

    return status;
  }, [activeCard, targetStatus, visibleTargets]);

  const tableTargets = visibleTargets.filter((target) => target.type === 'table-card');
  const buildTargets = visibleTargets.filter((target) => target.type === 'build');
  const captureTargets = visibleTargets.filter((target) => target.type === 'capture-top');

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f3d20] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_22%,rgba(0,0,0,0.35)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_55%,rgba(0,0,0,0.4)_100%)]" />

      <style>{`\n        .khasino-font { font-family: 'Playfair Display', serif; }\n      `}</style>

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait">
          {gameState.phase === 'setup' ? (
            <SetupScreen gameState={gameState} setGameState={setGameState} startGame={() => setGameState(createDemoPlayingState(gameState.playerCount, gameState.dealRound))} />
          ) : (
            <motion.section
              key="playing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid w-full gap-5 lg:grid-cols-[1fr_1.35fr_1fr]"
            >
              <div className="lg:col-span-3 flex items-center justify-between gap-4 rounded-[28px] border border-[#C9A84C]/25 bg-black/15 px-5 py-4 shadow-2xl backdrop-blur-md">
                <div>
                  <div className="text-xs uppercase tracking-[0.35em] text-[#f1d79a]">Khasino</div>
                  <div className="khasino-font text-3xl font-bold">Human turn sandbox</div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/70">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Active: {activePlayer?.name ?? 'Unknown'}</span>
                    {isHumanTurn ? null : <span className="rounded-full border border-[#C9A84C] bg-[#C9A84C]/15 px-3 py-1 text-[#f8edc6]">thinking...</span>}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/75">
                  <button type="button" onClick={onOpenRules} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-white/80">?</button>
                  <button type="button" onClick={onToggleLogDrawer} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-semibold text-white/80">Log</button>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Players: {gameState.playerCount}</span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Deal: {gameState.dealRound}</span>
                  <span className={`rounded-full border px-3 py-1 ${canDrift ? 'border-[#C9A84C] bg-[#C9A84C]/15 text-[#f8edc6]' : 'border-red-400/40 bg-red-500/10 text-red-100'}`}>
                    {canDrift ? 'Drift open' : 'Drift locked'}
                  </span>
                  <motion.button
                    type="button"
                    onClick={onBackToSetup}
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="rounded-full border border-[#C9A84C] px-4 py-2 font-semibold text-[#f8edc6]"
                  >
                    Back to setup
                  </motion.button>
                </div>
              </div>

              <div className="sticky bottom-3 z-20 lg:col-span-3 flex flex-wrap gap-2 rounded-[24px] border border-white/10 bg-[#0f2416]/90 px-4 py-3 text-sm text-white/75 backdrop-blur-md sm:static">
                <button type="button" onClick={() => setMode('capture')} disabled={controlsDisabled} className={`rounded-full px-4 py-2 font-semibold ${controlsDisabled ? 'cursor-not-allowed opacity-50' : ''} ${actionMode === 'capture' ? 'bg-[#C9A84C] text-[#1b241b]' : 'border border-white/10 bg-transparent text-white/75'}`}>
                  Capture
                </button>
                <button type="button" onClick={() => setMode('build-create')} disabled={controlsDisabled} className={`rounded-full px-4 py-2 font-semibold ${controlsDisabled ? 'cursor-not-allowed opacity-50' : ''} ${actionMode === 'build-create' ? 'bg-[#C9A84C] text-[#1b241b]' : 'border border-white/10 bg-transparent text-white/75'}`}>
                  Create Build
                </button>
                <button type="button" onClick={() => setMode('build-change')} disabled={controlsDisabled} className={`rounded-full px-4 py-2 font-semibold ${controlsDisabled ? 'cursor-not-allowed opacity-50' : ''} ${actionMode === 'build-change' ? 'bg-[#C9A84C] text-[#1b241b]' : 'border border-white/10 bg-transparent text-white/75'}`}>
                  Change Build
                </button>
                <button type="button" onClick={() => setMode('build-augment')} disabled={controlsDisabled} className={`rounded-full px-4 py-2 font-semibold ${controlsDisabled ? 'cursor-not-allowed opacity-50' : ''} ${actionMode === 'build-augment' ? 'bg-[#C9A84C] text-[#1b241b]' : 'border border-white/10 bg-transparent text-white/75'}`}>
                  Augment Build
                </button>
                <button type="button" onClick={() => setMode('build-stash')} disabled={controlsDisabled} className={`rounded-full px-4 py-2 font-semibold ${controlsDisabled ? 'cursor-not-allowed opacity-50' : ''} ${actionMode === 'build-stash' ? 'bg-[#C9A84C] text-[#1b241b]' : 'border border-white/10 bg-transparent text-white/75'}`}>
                  Stash
                </button>
              </div>

              <div className="lg:col-span-3 grid gap-5 lg:grid-cols-[1fr_1.2fr_1fr]">
                <SeatPanel
                  player={gameState.players[1]}
                  position="top"
                  isActive={gameState.currentPlayerIndex === 1}
                  isThinking={cpuThinkingPlayerIndex === 1}
                  isLifted={cpuThinkingPlayerIndex === 1 && cpuLiftedCardId !== null}
                />

                <div className="relative rounded-[32px] border border-[#C9A84C]/30 bg-[#153d22]/90 p-4 shadow-2xl backdrop-blur-md sm:p-5" ref={setTableSurfaceRef} onPointerMove={handlePointerMove} onTouchStart={handleTableTouchStart} onTouchMove={handleTableTouchMove} onTouchEnd={handleTableTouchEnd} onDragOver={(event) => event.preventDefault()} onDrop={(event) => event.preventDefault()} onClick={handleDriftClick} style={{ transform: `scale(${tableZoom})`, transformOrigin: 'top center' }}>
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Table</div>
                      <div className="khasino-font text-3xl font-bold">Drop or chow here</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75">Round {gameState.dealRound}</div>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[28px] border border-[#C9A84C]/20 bg-[#1a5c30]/70 p-4 shadow-inner">
                      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-[#f1d79a]">
                        <span>Table cards</span>
                        <span>Visible targets</span>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {tableTargets.map((target) => (
                          <TargetZone
                            key={target.id}
                            target={target}
                            activeCard={activeCard}
                            hoveredTargetId={hoveredTargetId}
                            selectedTargetIds={selectedTargetIds}
                            selectedBuildId={selectedBuildId}
                            targetStatus={targetStatus}
                            onClick={() => handleTargetClick(target)}
                            onDragOver={(event) => {
                              event.preventDefault();
                              setHoveredTargetId(target.id);
                              setCursor({ x: event.clientX, y: event.clientY });
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              handleTargetDrop(target);
                            }}
                            onPointerDown={(event) => handleTargetPressStart(target, event)}
                            onPointerUp={handleTargetPressEnd}
                            registerRef={registerZoneRef}
                            renderBody={() => (
                              <div className="flex flex-col gap-2">
                                <CardFace card={target.cards[0]} compact shimmer={targetStatus[target.id]?.isLegal && !!activeCard} />
                                <div className="text-xs text-white/80">{target.label}</div>
                              </div>
                            )}
                          />
                        ))}
                        {tableTargets.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">No table cards.</div> : null}
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-[28px] border border-[#C9A84C]/20 bg-[#1a5c30]/70 p-4 shadow-inner">
                        <div className="mb-3 text-xs uppercase tracking-[0.28em] text-[#f1d79a]">Build stacks</div>
                        <div className="grid gap-3">
                          {buildTargets.map((target) => (
                            <TargetZone
                              key={target.id}
                              target={target}
                              activeCard={activeCard}
                              hoveredTargetId={hoveredTargetId}
                              selectedTargetIds={selectedTargetIds}
                              selectedBuildId={selectedBuildId}
                              targetStatus={targetStatus}
                              onClick={() => handleTargetClick(target)}
                              onDragOver={(event) => {
                                event.preventDefault();
                                setHoveredTargetId(target.id);
                                setCursor({ x: event.clientX, y: event.clientY });
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleTargetDrop(target);
                              }}
                              onPointerDown={(event) => handleTargetPressStart(target, event)}
                              onPointerUp={handleTargetPressEnd}
                              registerRef={registerZoneRef}
                              renderBody={() => (
                                <div className="flex flex-col gap-3">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex -space-x-2">
                                    {target.cards.map((card) => (
                                      <div key={card.id} className="translate-y-0">
                                        <CardFace card={card} compact shimmer={targetStatus[target.id]?.isLegal && !!activeCard} />
                                      </div>
                                    ))}
                                    </div>
                                    <div className="text-right text-xs text-white/75">
                                      <div className="text-[11px] uppercase tracking-[0.25em] text-white/60">Owner</div>
                                      <div className="font-semibold" style={{ color: target.ownerColor ?? '#f8edc6' }}>{target.ownerName ?? 'Unknown'}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between gap-2 text-xs text-white/75">
                                    <div className="font-semibold text-[#f8edc6]">Target {target.value}</div>
                                    <div className="flex items-center gap-2">
                                      <span className="rounded-full border border-white/10 px-2 py-1">{target.isCompound ? 'Compound' : 'Simple'}</span>
                                      {target.stashed ? <span className="rounded-full border border-[#C9A84C] bg-[#C9A84C]/15 px-2 py-1 text-[#f8edc6]">STASH</span> : null}
                                    </div>
                                  </div>
                                </div>
                              )}
                            />
                          ))}
                          {buildTargets.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">No active builds.</div> : null}
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-[#C9A84C]/20 bg-[#1a5c30]/70 p-4 shadow-inner">
                        <div className="mb-3 text-xs uppercase tracking-[0.28em] text-[#f1d79a]">Opponent pile tops</div>
                        <div className="grid gap-3">
                          {captureTargets.map((target) => (
                            <TargetZone
                              key={target.id}
                              target={target}
                              activeCard={activeCard}
                              hoveredTargetId={hoveredTargetId}
                              selectedTargetIds={selectedTargetIds}
                              selectedBuildId={selectedBuildId}
                              targetStatus={targetStatus}
                              onClick={() => handleTargetClick(target)}
                              onDragOver={(event) => {
                                event.preventDefault();
                                setHoveredTargetId(target.id);
                                setCursor({ x: event.clientX, y: event.clientY });
                              }}
                              onDrop={(event) => {
                                event.preventDefault();
                                handleTargetDrop(target);
                              }}
                              onPointerDown={(event) => handleTargetPressStart(target, event)}
                              onPointerUp={handleTargetPressEnd}
                              registerRef={registerZoneRef}
                              renderBody={() => (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-3">
                                    <CardFace card={target.cards[0]} compact shimmer={targetStatus[target.id]?.isLegal && !!activeCard} />
                                    <div className="text-xs text-white/75">{target.label}</div>
                                  </div>
                                  <div className="flex flex-col items-end gap-1 text-right">
                                    <div className="text-[11px] uppercase tracking-[0.25em] text-white/55">Owner</div>
                                    <div className="font-semibold text-[#f8edc6]">{target.ownerName}</div>
                                  </div>
                                </div>
                              )}
                            />
                          ))}
                          {captureTargets.length === 0 ? <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">No opponent pile tops.</div> : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={setDriftRef}
                    className={`mt-4 rounded-[28px] border-2 border-dashed p-5 transition ${activeCard ? (canDrift ? 'border-[#C9A84C] bg-[#C9A84C]/10' : 'border-red-400/40 bg-red-500/10') : 'border-white/10 bg-white/5'}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setHoveredTargetId('table-drift-zone');
                      setCursor({ x: event.clientX, y: event.clientY });
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (actionMode !== 'capture' || !selectedHandCard) {
                        return;
                      }

                      if (canDrift) {
                        playDrift(selectedHandCard, boardRefs.current.driftRef?.getBoundingClientRect());
                      } else {
                        setShakeNonce((value) => value + 1);
                        pushToast('Drift is locked on the first 2-player deal while you own a build.');
                      }
                    }}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.28em] text-[#f1d79a]">Drift zone</div>
                        <div className="mt-1 text-sm text-white/80">Drop here to play without capturing.</div>
                      </div>
                      <div className="text-sm text-white/75">{canDrift ? 'Available' : 'Locked'}</div>
                    </div>
                  </div>
                </div>

                <SeatPanel
                  player={gameState.players[2]}
                  position="right"
                  isActive={gameState.currentPlayerIndex === 2}
                  isThinking={cpuThinkingPlayerIndex === 2}
                  isLifted={cpuThinkingPlayerIndex === 2 && cpuLiftedCardId !== null}
                />
              </div>

              {gameState.players[3] ? (
                <SeatPanel
                  player={gameState.players[3]}
                  position="far-right"
                  isActive={gameState.currentPlayerIndex === 3}
                  isThinking={cpuThinkingPlayerIndex === 3}
                  isLifted={cpuThinkingPlayerIndex === 3 && cpuLiftedCardId !== null}
                />
              ) : null}

              <div className="lg:col-span-3 rounded-[32px] border border-[#C9A84C]/30 bg-[#153d22]/90 p-4 shadow-2xl backdrop-blur-md sm:p-5">
                <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Your hand</div>
                        <div className="khasino-font text-3xl font-bold">Drag, click, then confirm</div>
                      </div>
                      {selectedHandCard ? <div className="rounded-full border border-[#C9A84C] bg-[#C9A84C]/15 px-4 py-2 text-sm text-[#f8edc6]">Selected {describeCard(selectedHandCard)}</div> : null}
                    </div>

                    <div className={`rounded-[28px] border border-white/10 bg-black/10 p-4 ${controlsDisabled ? 'pointer-events-none opacity-50' : ''}`}>
                      <HumanHand
                        player={gameState.players[0]}
                        selectedHandCardId={selectedHandCardId}
                        draggingHandCardId={draggingHandCardId}
                        selectedTargetIds={selectedTargetIds}
                        setSelectedHandCardId={setSelectedHandCardId}
                        setSelectedTargetIds={setSelectedTargetIds}
                        setDraggingHandCardId={setDraggingHandCardId}
                        registerCardRef={registerCardRef}
                        onCardDragStart={handleCardDragStart}
                        onCardDragEnd={handleCardDragEnd}
                        onCardDrop={(event, card) => {
                          event.preventDefault();
                          selectHandCard(card.id);
                        }}
                        onCardDragOver={(event) => event.preventDefault()}
                        onSelectTarget={handlePointerMove}
                        onSelectTargetClick={toggleTarget}
                        onCardPointerDown={handleHandCardPointerDown}
                        onCardPointerMove={handleHandCardPointerMove}
                        onCardPointerUp={handleHandCardPointerUp}
                      />
                    </div>
                  </div>

                  <div className={`rounded-[28px] border border-white/10 bg-black/15 p-4 ${shakeNonce ? 'animate-[shake_320ms_ease-in-out]' : ''}`}>
                    <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">{actionMode === 'capture' ? 'Capture' : 'Build'}</div>
                    <div className="mt-2 text-2xl font-semibold text-white">
                      {actionMode === 'capture' ? 'Chow selection' : buildAnalysis.title}
                    </div>
                    <div className="mt-3 grid gap-3 text-sm text-white/80">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">Selected card: {selectedHandCard ? describeCard(selectedHandCard) : 'None'}</div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        {actionMode === 'capture' ? 'Capture targets' : actionMode === 'build-change' || actionMode === 'build-stash' ? 'Selected build' : 'Build floor'}: {actionMode === 'capture' ? (selectionAnalysis.selectedTargets.length > 0 ? selectionAnalysis.selectedTargets.map((target) => target.label).join(', ') : 'None') : buildAnalysis.selectedBuild ? `${buildAnalysis.selectedBuild.targetValue} owned by ${buildAnalysis.selectedBuild.ownerName}` : 'None'}
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                        {actionMode === 'capture' ? 'Running sum' : 'Build sum'}: {actionMode === 'capture' ? `${selectionAnalysis.selectedSum} / ${selectionAnalysis.requiredSum}` : `${buildAnalysis.selectedFloorTargets.reduce((total, target) => total + target.value, 0) + (selectedHandCard?.rank ?? 0)} / ${buildAnalysis.targetValue || '?'}`}
                      </div>
                      {actionMode === 'capture' && selectionAnalysis.warning ? <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3 text-[#f8edc6]">{selectionAnalysis.warning}</div> : null}
                      {actionMode !== 'capture' && buildAnalysis.warning ? <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#C9A84C]/10 px-4 py-3 text-[#f8edc6]">{buildAnalysis.warning}</div> : null}
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/70">{actionMode === 'capture' ? selectionAnalysis.error : buildAnalysis.error}</div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-3">
                      {actionMode === 'capture' ? (
                        <>
                          <motion.button
                            type="button"
                            onClick={attemptConfirmCapture}
                            whileHover={{ y: -2, scale: selectionAnalysis.isValidCapture ? 1.01 : 1 }}
                            whileTap={{ scale: 0.98 }}
                            className={`rounded-full px-5 py-3 text-sm font-semibold ${selectionAnalysis.isValidCapture ? 'bg-[#C9A84C] text-[#1b241b] shadow-[0_12px_30px_rgba(0,0,0,0.28)]' : 'cursor-not-allowed bg-white/10 text-white/45'}`}
                          >
                            Chow!
                          </motion.button>
                          <motion.button
                            type="button"
                            onClick={handleDriftClick}
                            whileHover={{ y: -2, scale: 1.01 }}
                            whileTap={{ scale: 0.98 }}
                            className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white/80"
                          >
                            Drift instead
                          </motion.button>
                        </>
                      ) : (
                        <motion.button
                          type="button"
                          onClick={confirmBuildAction}
                          whileHover={{ y: -2, scale: buildAnalysis.isValid ? 1.01 : 1 }}
                          whileTap={{ scale: 0.98 }}
                          className={`rounded-full px-5 py-3 text-sm font-semibold ${buildAnalysis.isValid ? 'bg-[#C9A84C] text-[#1b241b] shadow-[0_12px_30px_rgba(0,0,0,0.28)]' : 'cursor-not-allowed bg-white/10 text-white/45'}`}
                        >
                          {buildAnalysis.confirmLabel} {buildAnalysis.targetValue || ''}
                        </motion.button>
                      )}
                      <button
                        type="button"
                        onClick={clearSelection}
                        className="rounded-full border border-white/10 bg-transparent px-5 py-3 text-sm font-semibold text-white/65"
                      >
                        Clear
                      </button>
                    </div>

                    <div className="mt-4 rounded-[24px] border border-white/10 bg-white/5 p-4">
                      <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">Turn log</div>
                      <div className="mt-3 space-y-2 text-sm text-white/75">
                        {gameState.gameLog.slice(0, 10).map((entry, index) => (
                          <div key={`${entry}-${index}`} className="rounded-xl border border-white/5 bg-black/10 px-3 py-2">
                            {entry}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <CardTooltip tooltip={cardTooltip} onClose={clearTooltip} />

              <motion.div
                className="pointer-events-none fixed z-40 rounded-full border border-[#C9A84C] bg-[#C9A84C]/15 px-3 py-2 text-xs font-semibold text-[#f8edc6] shadow-xl backdrop-blur-md"
                style={{ left: cursor.x + 18, top: cursor.y + 18, transform: 'translate(-50%, -50%)' }}
                animate={{ opacity: selectedTargetIds.length > 0 ? 1 : 0, scale: selectedTargetIds.length > 0 ? 1 : 0.9 }}
              >
                {selectedTargetIds.length > 0 ? `${selectionAnalysis.selectedSum} / ${selectionAnalysis.requiredSum}` : ''}
              </motion.div>

              <AnimatePresence>
                {moveAnimations.map((animation) => {
                  const flight = makeFlightPath(animation.fromRect, animation.toRect);

                  if (!flight) {
                    return null;
                  }

                  return (
                    <motion.div
                      key={animation.id}
                      initial={{ left: animation.fromRect.left, top: animation.fromRect.top, width: animation.fromRect.width, height: animation.fromRect.height, opacity: 0.98, rotate: -4, scale: 1 }}
                      animate={{ left: animation.fromRect.left + flight.x, top: animation.fromRect.top + flight.y, width: flight.width, height: flight.height, opacity: 0, rotate: 0, scale: 0.92 }}
                      transition={{ duration: 0.62, delay: animation.delay, ease: 'easeInOut' }}
                      className="pointer-events-none fixed z-30"
                    >
                      <div className="h-full w-full">
                        <CardFace card={animation.card} compact shimmer={getCardMeta(animation.card).isSpecial} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              <style>{`\n                @keyframes shake {\n                  0%, 100% { transform: translateX(0); }\n                  20% { transform: translateX(-6px); }\n                  40% { transform: translateX(6px); }\n                  60% { transform: translateX(-4px); }\n                  80% { transform: translateX(4px); }\n                }\n              `}</style>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

    </div>
  );
}

function SeatPanel({ player, position, isActive = false, isThinking = false, isLifted = false }) {
  if (!player) {
    return <div className="rounded-[28px] border border-white/10 bg-white/5 p-4 text-white/60">Empty seat</div>;
  }

  const faceDownCount = player.hand.length;
  const topCaptureCard = player.capturePile[0] ?? null;
  const remainingCaptureCount = Math.max(0, player.capturePile.length - 1);

  return (
    <motion.div
      animate={isActive ? { scale: [1, 1.01, 1], boxShadow: ['0 0 0 1px rgba(201,168,76,0.35), 0 18px 36px rgba(0,0,0,0.24)', '0 0 0 3px rgba(201,168,76,0.7), 0 18px 36px rgba(0,0,0,0.24)', '0 0 0 1px rgba(201,168,76,0.35), 0 18px 36px rgba(0,0,0,0.24)'] } : {}}
      transition={{ duration: 1.8, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
      className={`rounded-[28px] border bg-black/15 p-4 shadow-2xl backdrop-blur-md ${isActive ? 'border-[#C9A84C] ring-2 ring-[#C9A84C]/70' : 'border-white/10'} ${position === 'top' ? 'lg:col-span-3' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-[0.3em] text-[#f1d79a]">{player.isHuman ? 'You' : player.name}</div>
          <div className="mt-1 text-lg font-semibold text-white">{player.name}</div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/75">{faceDownCount} cards {isThinking ? <span className="inline-flex gap-1"><span className="animate-bounce">.</span><span className="animate-bounce [animation-delay:120ms]">.</span><span className="animate-bounce [animation-delay:240ms]">.</span></span> : null}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {player.isHuman ? (
          <div className="rounded-full border border-[#C9A84C] bg-[#C9A84C]/15 px-3 py-1 text-sm text-[#f8edc6]">Human seat</div>
        ) : (
          <>
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {Array.from({ length: Math.min(faceDownCount, 5) }, (_, index) => (
                <div key={`${player.id}-back-${index}`} className={index === 0 ? 'relative' : 'relative -ml-4'}>
                  <CardBack compact label={player.name} lifted={isLifted && index === 0} />
                </div>
              ))}
              {faceDownCount > 5 ? <div className="ml-1 rounded-[10px] border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/75">+{faceDownCount - 5}</div> : null}
            </div>
          </>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/65">
        <div className="flex items-center justify-between gap-3">
          <span>Capture pile</span>
          <span>{player.capturePile.length}</span>
        </div>
        <div className="mt-3 flex items-end gap-2">
          {topCaptureCard ? (
            <div className="relative">
              <CardFace card={topCaptureCard} compact ariaLabel={getCardAriaLabel(topCaptureCard, ['inspect capture pile'])} />
              {remainingCaptureCount > 0 ? <div className="absolute -right-2 -top-2 rounded-full border border-[#C9A84C] bg-[#C9A84C] px-2 py-1 text-[10px] font-semibold text-[#1b241b]">+{remainingCaptureCount}</div> : null}
            </div>
          ) : (
            <div className="rounded-[10px] border border-dashed border-white/15 px-3 py-2 text-white/45">Empty</div>
          )}
        </div>
        <div className="mt-3">Builds: {player.builds.length}</div>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [gameState, setGameState] = useState(() => createInitialGameState(2, 1));
  const [toasts, setToasts] = useState([]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [logDrawerOpen, setLogDrawerOpen] = useState(false);
  const toastTimersRef = useRef(new Map());
  const rulesSeenRef = useRef(false);

  useEffect(() => {
    try {
      rulesSeenRef.current = window.localStorage.getItem('khasino.rulesSeen') === '1';
    } catch {
      rulesSeenRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimersRef.current.clear();
    };
  }, []);

  const pushToast = (text) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((previousToasts) => [...previousToasts, { id, text }]);

    const timerId = window.setTimeout(() => {
      setToasts((previousToasts) => previousToasts.filter((toast) => toast.id !== id));
      toastTimersRef.current.delete(id);
    }, 1600);

    toastTimersRef.current.set(id, timerId);
  };

  const startGame = () => {
    setGameState(createDemoPlayingState(gameState.playerCount, gameState.dealRound));
    pushToast('Table ready. Human turn active.');

    if (!rulesSeenRef.current) {
      setShowRulesModal(true);
    }
  };
  const closeRulesModal = () => {
    setShowRulesModal(false);
    rulesSeenRef.current = true;

    try {
      window.localStorage.setItem('khasino.rulesSeen', '1');
    } catch {
      // Ignore storage failures.
    }
  };

  const backToSetup = () => {
    setGameState((previousState) => createInitialGameState(previousState.playerCount, previousState.dealRound));
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0f3d20] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,rgba(255,255,255,0.02)_22%,rgba(0,0,0,0.35)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,transparent_55%,rgba(0,0,0,0.4)_100%)]" />

      <style>{`\n        .khasino-font { font-family: 'Playfair Display', serif; }\n        @keyframes shake {\n          0%, 100% { transform: translateX(0); }\n          20% { transform: translateX(-6px); }\n          40% { transform: translateX(6px); }\n          60% { transform: translateX(-4px); }\n          80% { transform: translateX(4px); }\n        }\n      `}</style>

      <ToastStack toasts={toasts} />
      <GameLogDrawer open={logDrawerOpen} onToggle={() => setLogDrawerOpen((value) => !value)} gameLog={gameState.gameLog} />
      <RulesModal open={showRulesModal} onClose={closeRulesModal} />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-10">
        <AnimatePresence mode="wait">
          {gameState.phase === 'setup' ? (
            <SetupScreen gameState={gameState} setGameState={setGameState} startGame={startGame} />
          ) : (
            <PlayingScreen
              gameState={gameState}
              setGameState={setGameState}
              pushToast={pushToast}
              onBackToSetup={backToSetup}
              onToggleLogDrawer={() => setLogDrawerOpen((value) => !value)}
              onOpenRules={() => setShowRulesModal(true)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
