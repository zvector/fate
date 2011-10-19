/**
 * Object used by a deferral instance to store callback queues that are associated with its
 * resolved substates.
 */
function CallbackQueueTree ( rootState ) {
	var root, cache;
	
	Z.extend( this, {
		/**
		 * Returns the callback queue Array associated with the specified `state`; creates it if necessary.
		 */
		get: function ( state, readonly ) {
			var	path = state.path(),
				obj = cache[ path ],
				derivation, name, next, i, l;
			
			if ( obj ) { return obj; }
			
			obj = root;
			derivation = state.derivation( rootState );
			for ( i = 0, l = derivation.length; i < l; ) {
				name = derivation[i].name();
				next = ( obj[ name ] || !readonly && ( obj[ name ] = [] ) );
				++i < l && Z.isArray( next ) && ( next = obj[ name ] = { '': next } );
				obj = next;
			}
			return cache[ path ] = obj;
		},
		
		/**
		 * Discards callback queues; optionally limited to those associated with the specified state
		 * and its substates.
		 */
		empty: function ( state ) {
			var obj, path, pathDot, key, deletions, i, l;
			
			if ( !state || state === baseState ) {
				root = { '':[] }, cache = {};
			}
			else if ( baseState.isSuperstateOf( state ) ) {
				path = state.superstate().path();
				obj = Z.lookup( root, path );
				if ( obj ) {
					// Prune the branch associated with this state
					obj[ state.name() ] = null;
					
					// Remove any related cached entries
					pathDot = path + '.';
					for ( key in cache ) if ( Z.hasOwn.call( cache, key ) ) {
						( key === path || key.indexOf( pathDot ) === 0 ) &&
							deletions.push( key );
					}
					for ( i = 0, l = deletions.length; i < l; i++ ) {
						delete cache[ deletions[i] ];
					}
				}
			}
			return this;
		}
	});
	
	this.empty();
}
