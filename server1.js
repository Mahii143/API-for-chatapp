require("dotenv").config();

const uuid = require("uuid");
const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");
const PORT = 3001 || process.env.PORT;
const cors = require("cors");
const WebSocket = require("ws").Server;

const message = require("./message");

app.use(cors());
app.use(express.json());

const httpServer = app.listen(PORT, () => {
  console.log(`Server started on PORT: ${PORT}`);
});

const wapp = new WebSocket({ server: httpServer });
const clients = [];

const users = [
  {
    id: "mahir143",
    name: "mahir",
  },
  {
    id: "usman143",
    name: "usman",
  },
];

/**  Web socket starts **/
wapp.on("connection", (socket) => {
  const uid = uuid.v4();
  clients[uid] = socket;
  console.log(`Client ${uid} is connected!`);

  socket.on("message", (message) => {});

  socket.on("error", (error) => {});

  socket.on("close", () => {
    console.log(`Client disconnected!`);
  });
});
/**  Web socket ends **/

/**
 * when user login with an user name
 * he/she must enter either one of the above names
 * or else ill return 404 error
 */
app.get("/user", authenticateToken, (req, res) => {
  const user = users.filter((user) => user.name === req.user.name);
  console.log('user send');

  if (user.length === 0) return res.sendStatus(404);
  res.json(user);
});

app.get("/getmessages", authenticateToken, (_, res) => {
  message
    .getMessages()
    .then((response) => {
      res.status(200).send(response);
    })
    .then((error) => {
      res.status(500).send(error);
    });
});

app.get("/receiver", authenticateToken, (req, res) => {
  const authorisedUser = users.filter((user) => user.name === req.user.name);
  console.log('receiver send');
  if (authorisedUser.length === 0) return res.sendStatus(403);
  res.json(users.filter((user) => user.name !== req.user.name));
});

app.post("/send", (req, res) => {
  message
    .createMessage(req.body)
    .then((response) => {
      console.log(`Initiating websocket`);
      wapp.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(response);
          console.log(`Broadcasted ${response}`);
        } else {
          console.log(`WebSocket of ${client} is not open`);
        }
      });
      return res.status(200).send("success"); // Return the response here
    })
    .catch((error) => {
      console.log("Error in ", error);
      res.status(500).send("Internal server error");
    });
});

app.post("/login", (req, res) => {
  const { username } = req.body;
  const user = {
    name: username,
  };

  const authorisedUser = users.filter((u) => u.name === username);
  if (authorisedUser.length === 0) {
    return res.sendStatus(403);
  }
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
