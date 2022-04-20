require('dotenv').config();

const {
    IgApiClient,
    IgLoginTwoFactorRequiredError
  } = require('instagram-private-api');
const ig = new IgApiClient();
const fs = require('fs');

// Configure the app
const sesionPath = "./data/ig.json";
const userToSearch = 'desiredUser';
const followerLimit = 5000; // if -1 we get all the followers
const timeMargin = 6;
const listPath = "";
const listFileName = "followers_"+userToSearch+".txt";

function Save(data) {
  // here you would save it to a file/database etc.
  fs.writeFileSync(sesionPath, JSON.stringify(data), function(err, result) {
    if(err) console.error(err);
  });
  return data;
}

function Exists() {
  // here you would check if the data exists
  try {
    if(fs.existsSync(sesionPath)){
      const data = fs.readFileSync(sesionPath, 'utf8')
      if(data==""){
        return false;
      }else{
        return true;
      }
    }else{
      return false;
    }
  } catch(err) {
    console.error(err)
    return false;
  }
}

function Load() {
    try {
        const data = fs.readFileSync(sesionPath, 'utf8')
        // console.log(data)
        return JSON.parse(data);
      } catch (err) {
        console.error(err)
      }
  return '';
}


async function login() {
  ig.state.generateDevice(process.env.IG_USER);
  ig.state.proxyUrl = process.env.IG_PROXY;
  // This function executes after every request
  ig.request.end$.subscribe(async () => {
    const serialized = await ig.state.serialize();
    delete serialized.constants; // this deletes the version info, so you'll always use the version provided by the library
    Save(serialized);
  });
  if (Exists()) {
    // import state accepts both a string as well as an object
    // the string should be a JSON object
    await ig.state.deserialize(Load());
  }
  // This call will provoke request.end$ stream
  await ig.account.login(process.env.IG_USER, process.env.IG_PASS).catch(
    IgLoginTwoFactorRequiredError,
    async err => {
      const {
        username,
        totp_two_factor_on,
        two_factor_identifier
      } = err.response.body.two_factor_info;
      // decide which method to use
      const verificationMethod = totp_two_factor_on ? '0' : '1'; // default to 1 for SMS
      // At this point a code should have been sent
      // Get the code
      const {
        code
      } = await inquirer.prompt([{
        type: 'input',
        name: 'code',
        message: `Enter code received via ${verificationMethod === '1' ? 'SMS' : 'TOTP'}`,
      }, ]);
      // Use the code to finish the login process
      return ig.account.twoFactorLogin({
        username,
        verificationCode: code,
        twoFactorIdentifier: two_factor_identifier,
        verificationMethod, // '1' = SMS (default), '0' = TOTP (google auth for example)
        trustThisDevice: '1', // Can be omitted as '1' is used by default
      });
    },
  );
  // Most of the time you don't have to login after loading the state
}


login().then(async () => {
    const targetUser = await ig.user.searchExact(userToSearch);
    
    const followingFeed = ig.feed.accountFollowing(targetUser.pk);
    const followersFeed = ig.feed.accountFollowers(targetUser.pk);

    const followers = await getAllItemsFromFeed(followersFeed);
    const following = await getAllItemsFromFeed(followingFeed);
    
    const followersUsername = new Set(followers.map(({ username }) => username));
    // Filtering through the ones who aren't following you.
    const notFollowingYou = following.filter(({ username }) => !followersUsername.has(username));    
    
    var myNeededUsers = new Map();
    notFollowingYou.forEach(user =>  myNeededUsers.set(user.username,user.pk));

    GetFinalList(myNeededUsers);
    
  });

  // This function will get the final list filtering users with more than followerLimit followers
  async function GetFinalList(users){
    console.log("Getting final list");
    if(followerLimit != -1){
        const iterator1 = users.entries();
        var valIndex = 1;
        var remainingItems = users.size;
        while((val = iterator1.next().value)!=undefined){
            console.log(`Checking: ${valIndex}/${remainingItems} -> ${val[0]}`);
            valIndex++;
            ig.user.info(val[1]).then(foll => {
                if(foll.follower_count>followerLimit){
                    users.delete(val[0]);
                }
            }).catch(error => console.log(error));
            const time = Math.round(Math.random() * timeMargin * 1000) + 1000;
            await new Promise(resolve => setTimeout(resolve, time));
        }
    }
    SaveResponse(users);   
}

// This function will save the response
async function SaveResponse(string){
    const result = [...string.keys()].flat().join('\n')
    console.log("Saved in "+listPath+listFileName);
      fs.writeFile(listPath+listFileName, result, function(err, result) {
        if(err) console.error(err);
      });
}

// This function will get all the items from a feed
async function getAllItemsFromFeed(feed) {
  let items = [];
  do {
    items = items.concat(await feed.items());
  } while (feed.isMoreAvailable());
  return items;
}