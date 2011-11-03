Z.inherit( ResolvedState, State );

function ResolvedState ( superstate, name, resolverName ) {
	State.call( this, superstate, name );
	
	( this.resolverName = function () { return resolverName; })
		.toString = this.resolverName;
	
	return this;
}

Deferral.ResolvedState = ResolvedState;