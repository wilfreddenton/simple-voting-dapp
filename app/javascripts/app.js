// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'

// Import our contract artifacts and turn them into usable abstractions.
import voting_artifacts from '../../build/contracts/Voting.json'

// MetaCoin is our usable abstraction, which we'll use through the code below.
var Voting = contract(voting_artifacts);

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
var candidates;
var tokenPrice;
var isVoting = false;
var isStarting = true;
var isPurchasing = false;
var isLooking = false;

window.App = {
  start: function () {
    var self = this;

    // Bootstrap the Voting abstraction for Use.
    Voting.setProvider(web3.currentProvider);

    // get elements
    var voteForm = document.getElementById('vote');
    var buyForm = document.getElementById('buy');
    var infoForm = document.getElementById('info');
    var candidateNameInput = document.getElementById('candidate');
    var candidateTokensInput = document.getElementById('tokens');

    voteForm.addEventListener('submit', this.voteHandler.bind(this));
    buyForm.addEventListener('submit', this.purchaseHandler.bind(this));
    infoForm.addEventListener('submit', this.infoHandler.bind(this));

    // Get a list of the candidates and update votes
    Voting.deployed().then(function (instance) {
      return instance.allCandidates.call();
    }).then(function (_candidates) {
      // convert byte32 candidate names to strings
      candidates = _candidates.map(function (candidate) { return web3.toUtf8(candidate); });
      // create the html table with candidate info
      self.createCandidateTable();
      // get votes
      self.updateVotes();
      // update votes every 30 seconds
      setInterval(self.updateVotes.bind(self), 30000);
      // get token data
      self.getTokenData();
      // update token data every 30 seconds
      setInterval(self.getTokenData.bind(self), 30000);

      isStarting = false;
    }).catch(function (err) {
      alert(err);
    });
  },
  createCandidateTable: function () {
    var tbody = document.getElementById('candidate-rows');
    var frag = document.createDocumentFragment();

    candidates.forEach(function (candidate, i) {
      var row = document.createElement('tr');
      var dName = document.createElement('td');
      var dVotes = document.createElement('td');

      dName.innerHTML = candidate
      dVotes.id = 'candidate-' + (i + 1);

      row.appendChild(dName);
      row.appendChild(dVotes);
      frag.appendChild(row);
    });

    tbody.appendChild(frag);
  },
  getTokenData: function () {
    var self = this;

    var tokensTotal = document.getElementById('tokens-total');
    var tokensSold = document.getElementById('tokens-sold');
    var tokenCost = document.getElementById('token-cost');

    var voting;
    Voting.deployed().then(function (instance) {
      voting = instance;
      voting.totalTokens().then(function (totalTokens) {
        tokensTotal.innerHTML = totalTokens.toString();
      }).catch(function (err) { alert(err)});

      voting.tokensSold.call().then(function (_tokensSold) {
        tokensSold.innerHTML = _tokensSold.toString();
      }).catch(function (err) { alert(err)});

      voting.tokenPrice().then(function (_tokenPrice) {
        var tokenPriceStr = web3.fromWei(_tokenPrice.toString());
        tokenPrice = parseFloat(tokenPriceStr);
        tokenCost.innerHTML = tokenPriceStr + ' ETH';
      }).catch(function (err) { alert(err)});

      self.updateContractBalance(voting);
    });
  },
  updateContractBalance: function (voting) {
    var contractBalance = document.getElementById('contract-balance');
    web3.eth.getBalance(voting.address, function (err, balance) {
      if (err) {
        alert(err);
        return;
      }
      contractBalance.innerHTML = web3.fromWei(balance.toString()) + ' ETH';
    });
  },
  updateVotes: function () {
    var self = this;
    candidates.forEach(function (candidate) {
      Voting.deployed().then(function (instance) {
        return instance.totalVotesFor.call(candidate);
      }).then(function (numVotes) {
        self.updateCandidateVotes(candidate, numVotes.toString());
      }).catch(function (err) {
        alert(err);
      });
    });
  },
  updateCandidateVotes: function (candidate, numVotes) {
    var n = candidates.indexOf(candidate) + 1;
    document.getElementById('candidate-' + n).innerHTML = numVotes;
  },
  voteHandler: function (e) {
    e.preventDefault();

    var self = this;

    if (isStarting) {
      alert('The app is initializing. Please try again after it has finished.');
      return;
    }

    if (isVoting) {
      alert('Voting is in progress. Please try again after it has finished.');
      return;
    }

    var candidate = document.getElementById('candidate').value;
    if (candidate === '' || candidates.indexOf(candidate) < 0) {
      alert('invalid candidate:', candidate);
      return;
    }

    var numTokens = parseInt(document.getElementById('num-tokens-vote').value);
    if (isNaN(numTokens) || numTokens <= 0) {
      alert('invalid token amount:', numTokens);
      return;
    }

    isVoting = true;

    var msg = document.getElementById('msg');

    var cleanup = function () {
      msg.innerHTML = '';
      isVoting = false;
    };
    var voting;
    Voting.deployed().then(function (instance) {
      msg.innerHTML = '<p>Vote submitted. Please wait...</p>';
      voting = instance
      return voting.voteForCandidate(candidate, numTokens, {gas: 140000, from: web3.eth.accounts[0]});
    }).then(function () {
      return voting.totalVotesFor.call(candidate);
    }).then(function (numVotes) {
      self.updateCandidateVotes(candidate, numVotes.toString())
      cleanup();
    }).catch(function (err) {
      alert(err);
      cleanup();
    });
  },
  purchaseHandler: function (e) {
    e.preventDefault();

    var self = this;

    if (isStarting) {
      alert('The app is initializing. Please try again after it has finished.');
      return;
    }

    if (isPurchasing) {
      alert('Purchase is in progress. Please try again after it has finished.');
      return;
    }

    var numTokens = parseInt(document.getElementById('num-tokens-buy').value);
    if (isNaN(numTokens) || numTokens <= 0) {
      alert('Purchase amount must be greater than 0.');
      return;
    }

    var msg = document.getElementById('buy-msg');

    isPurchasing = true;
    var cleanup = function () {
      msg.innerHTML = '';
      isPurchasing = false;
    };
    var eth = numTokens * tokenPrice;
    var voting;
    Voting.deployed().then(function (instance) {
      voting = instance;
      msg.innerHTML = '<p>Purchase order submitted. Please wait...</p>';
      return voting.buy({value: web3.toWei(eth, 'ether'), gas: 140000, from: web3.eth.accounts[0]});
    }).then(function (_) {
      self.updateContractBalance(voting);
      self.getTokenData();
      cleanup();
    }).catch(function (err) {
      alert(err);
      cleanup();
    });
  },
  infoHandler: function (e) {
    e.preventDefault();

    if (isStarting) {
      alert('The app is initializing. Please try again after it has finished.');
      return;
    }

    if (isLooking) {
      alert('The app is looking. Please try again after it has finished.');
      return;
    }

    var voterInfo = document.getElementById('voter-info');
    var tokensBought = document.getElementById('tokens-bought');
    var votesCast = document.getElementById('votes-cast');
    var voterTable = document.getElementById('voter-table');

    if (voterInfo.value === '') {
      alert('Must enter a valid address');
      return;
    }

    isLooking = true;
    Voting.deployed().then(function (instance) {
      return instance.voterDetails.call(voterInfo.value)
    }).then(function (info) {
      tokensBought.innerHTML = info[0].toString();

      var numVotes = 0;
      if (info[1].length !== 0) {
        numVotes = info[1].reduce(function (acc, val) {
          return acc.plus(val);
        }).toString();
      }
      votesCast.innerHTML = numVotes;
      voterTable.classList.remove('hidden');

      isLooking = false;
    }).catch(function (err) {
      alert(err);
      isLooking = false;
    });
  }
};

window.addEventListener('load', function () {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://localhost:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
  }

  App.start();
});
