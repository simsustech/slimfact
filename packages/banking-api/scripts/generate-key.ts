import { generateKey, hashKey, keyPrefix } from "../src/api-keys/keys.js";

const env = process.argv[2] === "live" ? "live" : "test";
const key = generateKey(env);

console.log(`key:    ${key}`);
console.log(`prefix: ${keyPrefix(key)}`);
console.log(`hash:   ${hashKey(key)}`);
console.log("");
console.log("Paste the key into the mounted config file (BANKING_API_CONFIG_PATH);");
console.log("only the hash is stored in the DB. Edit + restart to rotate/revoke.");
