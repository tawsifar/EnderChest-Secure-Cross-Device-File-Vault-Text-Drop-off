import { google } from 'googleapis';
async function test() {
  console.log(google.drive({version: 'v3'}).files.get.toString());
}
test();
