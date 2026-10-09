// Adds a file that lives in ios/App/App to the App target's "Copy Bundle Resources" phase.
const xcode = require('xcode'); const fs = require('fs'); const path = require('path');
const name = process.argv[2]; const pbx = path.join(__dirname, '..', 'ios/App/App.xcodeproj/project.pbxproj');
const proj = xcode.project(pbx); proj.parseSync();
if (proj.hasFile(name)) { console.log(name, 'already in project'); process.exit(0); }
const groupKey = proj.findPBXGroupKey({ path: 'App' }) || proj.findPBXGroupKey({ name: 'App' });
const file = proj.addFile(name, groupKey, { lastKnownFileType: 'text.xml' });
if (!file) throw new Error('could not add file reference');
file.uuid = proj.generateUuid(); file.target = proj.getFirstTarget().uuid;
proj.addToPbxBuildFileSection(file);
proj.addToPbxResourcesBuildPhase(file);
fs.writeFileSync(pbx, proj.writeSync()); console.log('added', name);
