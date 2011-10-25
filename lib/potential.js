/**
 * Potential represents the branch of possible terminal states of a deferral; i.e., a deferral's
 * "resolved" State.
 */
Z.inherit( Potential, ResolvedState );

function Potential ( data, superstate, name, resolverName ) {
	if ( !( this instanceof Potential ) ) {
		return new Potential( data );
	}
	
	return ResolvedState.call( this, superstate, name, resolverName )
		.addSubstates( data );
}
Z.extend( Potential.prototype, {
	addSubstate: function ( type, name ) {
		var args = Z.slice.call( arguments );
		
		// Substate types of Potential should default to ResolvedState rather than Potential
		type && Z.isFunction( type ) ?
			type.prototype instanceof Potential && ( type = ResolvedState ) :
			( name = type, args.unshift( type = ResolvedState ) )
		
		return ResolvedState.prototype.addSubstate.apply( this, args );
	}
});

Deferral.Potential = Potential;