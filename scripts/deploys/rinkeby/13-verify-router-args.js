module.exports = [
    '0x57fd5b0CcC0Ad528050a2D5e3b3935c08F058Dca', // pair
    '0x359655dcB8A32479680Af81Eb38eA3Bb2B42Af54', // temple
    '0x5eD8BD53B0c3fa3dEaBd345430B1A3a6A4e8BD7C', // frax
    '0xA443355cE4F9c1AA6d68e057a962E86E071B0ed3', // treasury
    '0xA443355cE4F9c1AA6d68e057a962E86E071B0ed3', // earnings account
    {frax: 1000000, temple: 255100}, // dynamic price threshold
    2, // decay per block
    {frax: 100000, temple: 50000}, // interpolate from
    {frax: 100000, temple: 5000}, // interpolate to
];