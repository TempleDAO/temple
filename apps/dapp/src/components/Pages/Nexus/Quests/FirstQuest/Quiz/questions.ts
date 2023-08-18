// TODO: get these from env file

export type QuizQuestion = {
  question: string;
  answers: QuizAnswer[];
};

export type QuizAnswer = {
  answer: string;
  correct: boolean;
};

export const QUIZ_QUESTIONS = [
  {
    question: 'What is TPI?',
    answers: [
      {
        answer: 'A. Treasury Price Incoom',
        correct: false,
      },
      {
        answer: 'B. Temple Protection Implementation',
        correct: false,
      },
      {
        answer: 'C. Templar Pleasure Index',
        correct: false,
      },
      {
        answer: 'D. Treasury Price Index',
        correct: true,
      },
    ],
  },
  {
    question: 'What Defi mechanic does RAMOS utilize?',
    answers: [
      {
        answer: 'A. Automated Market Maker',
        correct: false,
      },
      {
        answer: 'B. Annual Marriage Offerings',
        correct: false,
      },
      {
        answer: 'C. Algorithmic Market Operations',
        correct: true,
      },
      {
        answer: 'D. Accredited Management Organization',
        correct: false,
      },
    ],
  },
  {
    question: 'What are Ritual Chambers?',
    answers: [
      {
        answer: 'A. Temple Projects',
        correct: true,
      },
      {
        answer: 'B. Metaverse Locations',
        correct: false,
      },
      {
        answer: 'C. Love Love Hotels',
        correct: false,
      },
      {
        answer: 'D. Discord Channels',
        correct: false,
      },
    ],
  },
  {
    question:
      'What is the likelihood of a rebalance event if temple spot price is at least -1% or +3% away from Treasury Price Index?',
    answers: [
      {
        answer: 'A. 1%',
        correct: false,
      },
      {
        answer: 'B. 5%',
        correct: true,
      },
      {
        answer: 'C. 50%',
        correct: false,
      },
      {
        answer: 'D. 100%',
        correct: false,
      },
    ],
  },
  {
    question:
      'What is the likelihood of a Rebalance event if TEMPLE spot price is more than -3% lower than the Treasury Price Index?',
    answers: [
      {
        answer: 'A. 1%',
        correct: false,
      },
      {
        answer: 'B. 5%',
        correct: false,
      },
      {
        answer: 'C. 50%',
        correct: false,
      },
      {
        answer: 'D. 100%',
        correct: true,
      },
    ],
  },
  {
    question: 'Which Enclave makes deliberations on the Treasury Strategic Proposals?',
    answers: [
      {
        answer: 'A. Mystery',
        correct: false,
      },
      {
        answer: 'B. Structure',
        correct: false,
      },
      {
        answer: 'C. Logic',
        correct: true,
      },
      {
        answer: 'D. Order',
        correct: false,
      },
    ],
  },
  {
    question: 'Relics which act as passport NFTs for Templars conform to which ERC standard?',
    answers: [
      {
        answer: 'A. ERC-4262',
        correct: false,
      },
      {
        answer: 'B. ERC-1155',
        correct: false,
      },
      {
        answer: 'C. ERC-721',
        correct: true,
      },
      {
        answer: 'D. ERC-6969',
        correct: false,
      },
    ],
  },
  {
    question: 'The reward a user receives for completing Nexus Quests are called',
    answers: [
      {
        answer: 'A. Waifus',
        correct: false,
      },
      {
        answer: 'B. Liquid Tokens',
        correct: false,
      },
      {
        answer: 'C. Shards',
        correct: true,
      },
      {
        answer: 'D. Honey',
        correct: false,
      },
    ],
  },
  {
    question: 'How does RAMOS rebalance to raise TEMPLE spot price?',
    answers: [
      {
        answer: 'A. Pulling TEMPLE single-sidedly from LP',
        correct: true,
      },
      {
        answer: 'B. Burning incense',
        correct: false,
      },
      {
        answer: 'C. Staking TEMPLE into Core Vault',
        correct: false,
      },
      {
        answer: 'D. Add USD single-sidedly into LP',
        correct: false,
      },
    ],
  },
  {
    question: 'How does RAMOS mitigate arbitrage, front-running, and MEV attacks?',
    answers: [
      {
        answer: 'A. Limit Orders',
        correct: false,
      },
      {
        answer: 'B. Randomisation',
        correct: true,
      },
      {
        answer: 'C. Insurance',
        correct: false,
      },
      {
        answer: 'D. Use Flashbots',
        correct: false,
      },
    ],
  },
  {
    question: 'Who is responsible for managing the work within a Rituals Chamber?',
    answers: [
      {
        answer: 'A. Founder',
        correct: false,
      },
      {
        answer: 'B. President',
        correct: false,
      },
      {
        answer: 'C. Chairman',
        correct: false,
      },
      {
        answer: 'D. MC',
        correct: true,
      },
    ],
  },
  {
    question: 'Which is the primary LP managed by RAMOS?',
    answers: [
      {
        answer: 'A. TEMPLE/DAI',
        correct: true,
      },
      {
        answer: 'B. TEMPLE/FRAX',
        correct: false,
      },
      {
        answer: 'C. frxETH/ETH',
        correct: false,
      },
      {
        answer: 'D. TEMPLE/gOHM',
        correct: false,
      },
    ],
  },
  {
    question: 'What can you possibly gain from earning and minting a Shard?',
    answers: [
      {
        answer: 'A. Whitelisted access to future launches or drops',
        correct: false,
      },
      {
        answer: 'B. Mint pass for NFT projects',
        correct: false,
      },
      {
        answer: 'C. Tradeable NFT rewards from completed quests',
        correct: false,
      },
      {
        answer: 'D. All of the above',
        correct: true,
      },
    ],
  },
  {
    question: 'What is the accurate lexicon for Origami Tokens?',
    answers: [
      {
        answer: 'A. tToken/tvToken',
        correct: false,
      },
      {
        answer: 'B. oToken/ovToken',
        correct: true,
      },
      {
        answer: 'C. jpgToken/jpegToken',
        correct: false,
      },
      {
        answer: 'D. oToken/oreoToken',
        correct: false,
      },
    ],
  },
  {
    question: 'The reserve token to vault share token ratio in an Origami vault is equal to',
    answers: [
      {
        answer: 'A. reservePerShare',
        correct: true,
      },
      {
        answer: 'B. reservePerTemple',
        correct: false,
      },
      {
        answer: 'C. reservePerOrigami',
        correct: false,
      },
      {
        answer: 'D. TPI/TEMPLE',
        correct: false,
      },
    ],
  },
  {
    question: 'The TempleDAO Opening Ceremony took place in the',
    answers: [
      {
        answer: 'A. ETHDenver',
        correct: false,
      },
      {
        answer: 'B. Nexus',
        correct: false,
      },
      {
        answer: 'C. Metaverse',
        correct: true,
      },
      {
        answer: 'D. Ibiza',
        correct: false,
      },
    ],
  },
  {
    question: 'Origami Vault Reserve Tokens (oTokens) are backed by the underlying token at a ratio of',
    answers: [
      {
        answer: 'A. 1:1',
        correct: true,
      },
      {
        answer: 'B. 1:2',
        correct: false,
      },
      {
        answer: 'C. 1:10',
        correct: false,
      },
      {
        answer: 'D. 2:1',
        correct: false,
      },
    ],
  },
  {
    question: 'Nexus Quest Shards should be stored in a',
    answers: [
      {
        answer: 'A. Metamask wallet',
        correct: false,
      },
      {
        answer: 'B. Relic',
        correct: true,
      },
      {
        answer: 'C. Core Vault',
        correct: false,
      },
      {
        answer: 'D. Treasure Chest',
        correct: false,
      },
    ],
  },
  {
    question: 'The process of using the Forge to convert one Shard to another is called',
    answers: [
      {
        answer: 'A. Metamorphosis',
        correct: false,
      },
      {
        answer: 'B. Transformation',
        correct: false,
      },
      {
        answer: 'C. Transmutation',
        correct: true,
      },
      {
        answer: 'D. Transfiguration',
        correct: false,
      },
    ],
  },
  {
    question:
      'Origami is a _____ protocol that supercharges yield for any supported DeFi protocol to maximize returns and provide on-demand liquidity.',
    answers: [
      {
        answer: 'A. Vote escrow staking',
        correct: false,
      },
      {
        answer: 'B. Liquid wrapper',
        correct: true,
      },
      {
        answer: 'C. Proof of liquidity',
        correct: false,
      },
      {
        answer: 'D. Liquidation engine',
        correct: false,
      },
    ],
  },
];

export const pickQuestions = (numberOfQuestions: number) => {
  const shuffled = [...QUIZ_QUESTIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, numberOfQuestions);
}