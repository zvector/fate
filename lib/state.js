// this is static/shared on the deferral prototype, should not hold reference to any deferral instance

function State ( superstate, name, resolver ) {
	this.name = name || '';
	this.path = superstate ? ( superstate.path ? superstate.path + '.' + name : name ) : '';
	resolver && ( this.resolver = resolver );
}
State.prototype.addSubstate = function ( name, resolver ) {
	return ( this.substates || ( this.substates = {} ) )[ name ] = new State( this, name, resolver );
};

