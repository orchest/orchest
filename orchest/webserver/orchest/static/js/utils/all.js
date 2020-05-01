export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export function handleErrors(response) {
    if (!response.ok) {
        throw Error(response.statusText);
    }
    return response;
}

export function nameToFilename(name){
    return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

export function extensionFromFilename(filename){
  if(filename.indexOf(".") === -1){
    return "";
  }
  let pieces = filename.split(".");
  return pieces[pieces.length-1];
}

export function filenameWithoutExtension(filename){
  let pieces = filename.split(".");
  return pieces.slice(0, pieces.length - 1).join(".");
}

export function intersectRect(r1, r2) {
  return !(r2.x > r1.x + r1.width || 
           r2.x + r2.width < r1.x || 
           r2.y > r1.y + r1.height ||
           r2.y + r2.height < r1.y);
}

import variables from '../../css/vars.scss';

export function globalMDCVars(){
  return variables
}