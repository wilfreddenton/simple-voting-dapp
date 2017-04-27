var Voting = artifacts.require("./Voting.sol");

module.exports = function(deployer) {
  deployer.deploy(Voting, 1000, web3.toWei('0.001', 'ether'), ['2B', '9S', 'A2']);
};
