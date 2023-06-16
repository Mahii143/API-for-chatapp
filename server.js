require("dotenv").config();
const uuid = require("uuid");
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const PORT = 3002 || process.env.PORT;
const cors = require("cors");
const WebSocket = require("ws").Server;

// const message = require("./message");
const message2 = require("./message2");

app.use(cors());
app.use(express.json());

const httpServer = app.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});

const wapp = new WebSocket({ server: httpServer });
const clients = [];

const users2 = [
  {
    id: "mahir143",
    name: "mahir",
  },
  {
    id: "usman143",
    name: "usman",
  },
];

/** user CRUD operation (create user, get all users) */

/** */
let users = [];
const getusers = async function () {
  try {
    const response = await message2.getUsers();
    users = [...response];
    // console.log(users);
  } catch (err) {}
};

(async () => await getusers())();

// console.log("users from server", users2);

app.get("/users", async (req, res) => {
  try {
    const response = await message2.getUsers();
    console.log(response);
    res.status(200).send(response);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

app.get("/sender", authenticateToken, (req, res) => {
  const user = users.find((user) => user.name === req.user.name);
  // console.log("user send");
  if (user === null) return res.sendStatus(404);
  res.json(user);
});

app.post("/user", async (req, res) => {
  try {
    const response = await message2.createUser(req.body);
    // console.log(response);
    (async () => await getusers())();
    res.status(200).send(response);
  } catch (err) {
    console.log(err);
    res.status(500).send(err);
  }
});

/**  Web socket starts **/
const channelsAndClients = {};
wapp.on("connection", (socket) => {
  const uid = uuid.v4();

  clients[uid] = socket;
  const client = {
    uid: uid,
    socket: socket,
  };
  console.log(`Client ${uid} is connected!`);

  socket.on("message", (message) => {
    const messageObj = JSON.parse(message.toString());

    if (messageObj.message === "connected to channel" && messageObj.channel) {
      if (!channelsAndClients[messageObj.channel]) {
        channelsAndClients[messageObj.channel] = [];
      }
      if (
        messageObj.prevChannel &&
        messageObj.prevChannel !== messageObj.channel &&
        channelsAndClients[messageObj.prevChannel].includes(client)
      ) {
        console.log(`already exist ${client} on ${messageObj.channel}`);
        channelsAndClients[messageObj.prevChannel] = channelsAndClients[
          messageObj.prevChannel
        ].filter((cl) => cl.uid !== client.uid);
      }
      if (client && channelsAndClients[messageObj.channel]) {
        if (!channelsAndClients[messageObj.channel].includes(client)) {
          channelsAndClients[messageObj.channel].push(client);
        }
      }

      // console.log(channelsAndClients);
      // console.log(messageObj);
    }
  });

  socket.on("error", (error) => {});

  socket.on("close", () => {
    for (const channel in channelsAndClients) {
      channelsAndClients[channel] = channelsAndClients[channel].filter(
        (cl) => cl.uid !== client.uid
      );
    }
    console.log(`Client disconnected!`);
  });
});

/**  Web socket ends **/

/**
 *  Getting channel data from table using User ID starts
 *  What are all the channels a user subscribed in
 */

app.get("/channel-participating", authenticateToken, (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  const id = users.find((user) => user.name === req.user.name).id; // user id

  message2
    .getChannelsOfUser(id)
    .then((response) => {
      res.status(200).send(response);
    })
    .then((error) => {
      res.status(500).send(error);
    });
});

/**  Getting channel data from table using User ID ends */

/**
 *  Getting all channel participants data from table using channel id starts
 *  What are all the users subscribed to the channel
 */

app.post("/channel-participants", authenticateToken, (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  // console.log(req.body);
  message2
    .getUsersOfChannel(req.body)
    .then((response) => {
      // console.log("response", response);
      let participants = [];
      response.forEach((participant) => {
        const obj = users.find((user) => user.id === participant.part_user_id);
        if (obj) participants.push(obj);
      });
      // console.log("participants", participants);
      res.status(200).send(participants);
    })
    .then((error) => {
      res.status(500).send(error);
    });
});

/**  Getting channel data from table using User ID ends */

/**  Getting messages from table using channel ID starts */

app.post("/channel-messages", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  const user_id = users.find((user) => user.name === req.user.name).id; // user id

  const { channel_id } = req.body;

  try {
    const response = await message2.checkUserChannel(user_id, channel_id);
    const isAuthorised = response[0].is_authorised;
    // console.log(isAuthorised);

    if (!isAuthorised) return res.sendStatus(403);

    let messages = await message2.getMessagesOfChannel(channel_id);
    // console.log(messages);
    try {
      messages = messages.map((message) => {
        const sender = users.find((user) => user.id === message.sender_id);
        if (sender) {
          message.sender_name = sender.name;
        } else {
          message.sender_name = "Unknown";
          console.error(`No user found for sender_id: ${message.sender_id}`);
        }
        return message;
      });
    } catch (error) {
      console.error("Error occurred during message mapping:", error);
      // Handle the error and send an appropriate response
      // res.status(500).send("Internal server error");
    }
    res.status(200).send(messages);
  } catch (error) {
    res.status(500).send(error);
  }
});
/**  Getting messages from table using channel ID ends */

/**  Getting channels from table using channel ID starts */

app.post("/get-channel", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  const user_id = users.find((user) => user.name === req.user.name).id; // user id

  const { channel_id } = req.body;
  // console.log(user_id + " " + channel_id);

  try {
    const response = await message2.checkUserChannel(user_id, channel_id);
    const isAuthorised = response[0].is_authorised;
    // console.log(isAuthorised);

    if (!isAuthorised) return res.sendStatus(403);

    const channel = await message2.getChannel(channel_id);
    res.status(200).send(channel);
  } catch (error) {
    res.status(500).send(error);
  }
});
/**  Getting channels from table using channel ID ends */

/**  API for sending message to a specific channel starts */
app.post("/send-message", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  req.user = users.find((user) => user.name === req.user.name);
  // console.log(req.user);
  try {
    const response = await message2.sendMessage(req);
    if (channelsAndClients[req.body.channel_id]) {
      const clients = channelsAndClients[req.body.channel_id];
      let message = JSON.parse(response); // Replace with your actual message

      // console.log('after changing',message);
      clients.forEach((client) => {
        const { socket } = client;
        if (socket.readyState === 1) {
          // console.log("sender details", req.user.name);
          message = { sender_name: req.user.name, ...message };
          // console.log("After adding sender_name:", message);
          socket.send(JSON.stringify(message));

          // console.log(
          //   `Broadcasted ${JSON.stringify(message)} to Client ${client.uid}`
          // );
        } else {
          console.log(`WebSocket of Client ${client.uid} is not open`);
        }
      });
    } else {
      console.log(`Channel ${req.body.channel_id} does not exist`);
    }
    return res.status(200).send("Successfully inserted!");
  } catch (error) {
    res.status(500).send(error);
  }
});
/**  API for sending message to a specific channel ends */

/**  API for creating a channel starts */
app.post("/create-channel", authenticateToken, async (req, res) => {
  // console.log('user', req.user.name);
  // console.log(users);
  const authorisedUser = users.find((user) => user.name === req.user.name);
  // console.log('create channel', authorisedUser);
  if (!authorisedUser) return res.status(403).send("forbidden");
  req.user.id = users.find((user) => user.name === req.user.name).id;
  try {
    const response = await message2.createChannel(req);
    return res.status(200).send(response);
  } catch (error) {
    return res.status(500).send(error);
  }
});
/**  API for creating a channel ends */

/**  API for creating a invite code starts */

app.post("/create-invite", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  user_id = users.find((user) => user.name === req.user.name).id;

  try {
    const auth = await message2.checkAdmin(user_id, req.body.channel_id);
    const { is_authorised } = auth[0];

    if (!is_authorised) return res.status(403).send("not an admin");

    const response = await message2.createInviteCode(req.body);

    // console.log(response);
    res.status(200).send(response);
  } catch (error) {
    res.status(500).send(error);
  }
});

/**  API for creating a invite code ends */

/**  API for getting available invite code for a channel starts */

app.post("/get-invite", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);

  try {
    const response = await message2.getInviteCode(req.body);
    // console.log(response);
    res.status(200).send(response);
  } catch (error) {
    res.status(500).send(error);
  }
});

/**  API for getting available invite code for a channel ends */

/**  API for getting available channel for the invite code starts */

app.post("/get-invited-channel", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);

  try {
    const response = await message2.getInviteChannel(req.body);
    // console.log(response);
    res.status(200).send(response);
  } catch (error) {
    res.status(500).send(error);
  }
});

/**  API for getting available channel for the invite code ends */

/**  API for joining a channel ends */

app.post("/join-channel", authenticateToken, async (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  if (authorisedUser.length === 0) return res.sendStatus(403);
  req.user.id = users.find((user) => user.name === req.user.name).id;

  try {
    const response = await message2.joinChannel(req);
    return res.status(200).send(response);
  } catch (error) {
    return res.status(500).send(error);
  }
});

/**  API for joining a channel ends */

/**
 * when user login with an user name
 * he/she must enter either one of the above names
 * or else ill return 404 error
 */
// app.get("/user", authenticateToken, (req, res) => {
//   const user = users.filter((user) => user.name === req.user.name);
//   if (user.length === 0) return res.sendStatus(404);
//   res.json(user);
// });

// app.get("/getmessages", authenticateToken, (_, res) => {
//   message
//     .getMessages()
//     .then((response) => {
//       res.status(200).send(response);
//     })
//     .then((error) => {
//       res.status(500).send(error);
//     });
// });

// app.get("/reciever", authenticateToken, (req, res) => {
//   const authorisedUser = users.filter((user) => user.name === req.user.name);
//   if (authorisedUser.length === 0) return res.sendStatus(403);
//   res.json(users.filter((user) => user.name !== req.user.name));
// });

// app.post("/send", (req, res) => {
//   message
//     .createMessage(req.body)
//     .then((response) => {
//       console.log(`Initiating websocket`);
//       wapp.clients.forEach((client) => {
//         if (client.readyState === 1) {
//           client.send(response);
//           console.log(`Broadcasted ${response}`);
//         } else {
//           console.log(`WebSocket of ${client} is not open`);
//         }
//       });
//       return res.status(200).send("success"); // Return the response here
//     })
//     .catch((error) => {
//       console.log("Error in ", error);
//       res.status(500).send("Internal server error");
//     });
// });

app.post("/login", async (req, res) => {
  const { username } = req.body;
  // console.log(req.body);
  const authorisedUser = users.find((u) => u.name === username);
  // console.log('auth',authorisedUser);
  if (!authorisedUser) {
    return res.status(403).send("forbidden");
  }
  const user = {
    name: username,
  };
  // console.log("available users: ", users, "authorised", authorisedUser);
  const accessToken = jwt.sign(user, process.env.ACCESS_SECRET_TOKEN);
  const refreshToken = jwt.sign(user, process.env.REFRESH_SECRET_TOKEN);

  res.json({
    accessToken: accessToken,
    refreshToken: refreshToken,
  });
});

/**
 *
 * @param {Headers=> authorization: Bearer TOKEN} req
 * @param {*} res
 * @param {*} next
 * @returns user json object
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token === null) return res.sendStatus(401);

  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}
