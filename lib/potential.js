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
