// Extension for basicmixin.js interface
// Basic Node mixin for parent - children relationships (links)
// It contains some facilities related to parent children link elements: load, clone, addChild, etc...

import {copyProps} from './basicmixin.mjs';

export function getRoot(element) {
  if (!element._parent) return element;
  else return getRoot(element._parent);
}

const linksMixin=Sup => class extends Sup {
  // parent and children names have an uderline because we are using them for storing eather parent and partner as well ass children and relationships. This way we will not access this elements directly but through their alias that depend of if it is a linker or a data node.
  constructor(props) {
    super(props);
    // parent is unique while children is a list element
    this._parent=null;
    this._children=[];
  }
  
  // source: is the source object to be loaded from
  // levelUp and down: If not missed it limites the number of loading steps for the correspondent upwards and downwards elements
  // thisProps, up and down: when not missed it is an array of the properties names that should be loaded for the current element. And the upwards and downwards version.
  // The load procedures would replace children and parent
  load(source, levelUp, levelDown, thisProps, thisPropsUp, thisPropsDown) {
    copyProps(this, source, thisProps); // basic data load (props)
    if (levelUp !== 0) {
      this.loadAsc(source, levelUp, thisPropsUp);
    }
    if (levelDown !== 0) {
      this.loadDesc(source, levelDown, thisPropsDown);
    }
    return this;
  }
  
  clone(levelUp, levelDown, thisProps, thisPropsUp, thisPropsDown) {
    const myClon=new this.constructor();
    myClon.load(this, levelUp, levelDown, thisProps, thisPropsUp, thisPropsDown);
    return myClon;
  }

  loadDesc(source, level, thisProps) {
    if (level===0) return;
    if (level > 0) level--;
    this._children=[]; // reset children
    for (const i in source._children) {
      this._children[i]=new this.constructor;
      this._children[i]._parent=this;
      copyProps(this._children[i], source._children[i], thisProps); // loading just some props
      this._children[i].loadDesc(source._children[i], level, thisProps);
    }
  }

  loadAsc(source, level, thisProps) {
    if (level===0) return;
    if (level > 0) level--;
    this._parent=null; // reset parent
    this._parent=new this.constructor;
    copyProps(this._parent, source._parent, thisProps);
    this._parent.addChild(this); // new thing
    this._parent.loadAsc(source._parent, level, thisProps);
  }
  
  static getRoot(element){
    return getRoot(element);
  }

  getRoot(){
    return getRoot(this);
  }

  // Finds the child which value is as in obj key value pair. If no argument it returs first child
  getDescendent(objSearch) {
    if (!objSearch) return this._children[0];
    return this._children.find(child=>
      Object.entries(objSearch).every(([objKey, objValue])=>
        Object.entries(child.props).find(([childKey, childValue])=>objKey==childKey && objValue==childValue)));
  }

  addDescendent(obj) { // It replaces previous parent if present
    this._children.push(obj);
    obj._parent=this;
    return obj;
  }

  removeDescendent(obj) {
    if (obj) this._children = this._children.filter(child => child != obj);
  }

  removeDescendents(){
    this._children=null;
  }

  // Finds the child which value is as in obj key value pair. If no argument it returs first child
  getAscendent(objSearch) {
    if (!this._parent) return;
    if (!objSearch) return this._parent;
    return Object.entries(objSearch).every(([objKey, objValue])=>
      Object.entries(this._parent.props).find(([parentKey, parentValue])=>objKey==parentKey && objValue==parentValue));
  }

  setAscendent(obj) { // It replaces previous parent if present
    this._parent=obj;
    obj.addChild(this);
    return obj;
  }

  removeAscendent(obj) {
    if (!obj) this._parent=null;
    if (this._parent===obj) this._parent=null;
  }

  arrayFromTree() {
    let container=[];
    container.push(this);
    for (const obj of this._children) {
      container=container.concat(obj.arrayFromTree());
    }
    return container;
  }
}

export default linksMixin;
/*
cambios con respecto al código antiguo: loadasc => loadAsc, loaddesc => loadDesc, getrootnode getRoot, levelup => levelUp, leveldown => levelDown, cloneNode => clone
childtablekeys - childTableKeys
childtablekeysinfo - childTableKeysInfo
syschildtablekeys - sysChildTableKeys
syschildtablekeysinfo - sysChildTableKeysInfo
getMyRoot getRoot
*/