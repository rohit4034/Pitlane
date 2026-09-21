import http from 'node:http';
import handler from './server.mjs';
const port=Number(process.env.PITLANE_APP_PORT||3080);
http.createServer(handler).listen(port,'127.0.0.1',()=>console.log('Pitlane advisor app: http://127.0.0.1:'+port));
