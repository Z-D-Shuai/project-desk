let namespace='project-desk-ui';
export function configurePreferences(path){namespace='project-desk-ui:'+path;}
export function preference(key,fallback){try{return JSON.parse(localStorage.getItem(namespace+':'+key))??fallback;}catch{return fallback;}}
export function savePreference(key,value){try{localStorage.setItem(namespace+':'+key,JSON.stringify(value));return true;}catch{return false;}}
