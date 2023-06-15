const Pool = require("pg").Pool;
const pool = new Pool({
  user: "admin",
  host: "localhost",
  database: "postgres",
  password: "admin",
  port: 5432,
});

const getMessages = () => {
  return new Promise(function (resolve, reject) {
    pool.query(
      'SELECT sender_id, receiver_id, content, timestamp FROM public."MessageHistory" ORDER BY timestamp DESC',
      (error, result) => {
        if (error) reject(error);
        if (result && result.rows) {
          resolve(result.rows);
        } else {
          reject(
            new Error("Query result is undefined or missing rows property")
          );
        }
      }
    );
  });
};

const createMessage = (body) => {
  return new Promise(function (resolve, reject) {
    const { senderid, receiverid, content, timestamp } = body;
    pool.query(
      'INSERT INTO public."MessageHistory" ( sender_id, receiver_id, content, timestamp) VALUES ($1, $2, $3, $4) RETURNING *',
      [senderid, receiverid, content, timestamp],
      (error, _) => {
        if (error) reject(error);
        resolve(
          JSON.stringify({
            sender_id: senderid,
            reciever_id: receiverid,
            content: content,
            timestamp: timestamp,
          })
        );
      }
    );
  });
};

module.exports = {
  getMessages,
  createMessage,
};
