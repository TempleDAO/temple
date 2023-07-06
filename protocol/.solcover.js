module.exports = {
    skipFiles: [
        'util/ABDKMath',  // ABDKMath has issues compiling in solcover
        'fakes',          // Ignore fakes
    ]
};