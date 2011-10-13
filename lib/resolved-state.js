Z.inherit( ResolvedState, State );

function ResolvedState ( superstate, name, resolverName ) {
	State.call( this, superstate, name );
	
	Z.extend( this, {
		resolverName: function () {
			return resolverName;
		}
	});
	
	return this;
}
