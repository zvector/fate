/**
 * A **pipeline** executes a sequence of synchronous or asynchronous functions in order, passing a set of
 * arguments from one to the next as each operation completes.
 */
function Pipeline ( operations ) {
	if ( !( this instanceof Pipeline ) ) {
		return new Pipeline( operations );
	}
	
	var	self = this,
		operation,
		args,
		deferral = ( new Deferral ).as( self ),
		running = false,
		pausePending = false,
		events = Z.nullHash([ 'didOperation', 'willContinue' ]);
	
	function next () {
		return operation = operations.shift();
	}
	
	function emit ( eventType ) {
		var	callbacks = events[ eventType ],
			i, l;
		if ( callbacks ) {
			for ( i = 0, l = callbacks.length; i < l; i++ ) {
				callbacks[i].call( self, { target: self, operation: operation, args: args } );
			}
		}
	}
	
	function continuation () {
		var result;
		if ( Z.isFunction( this ) ) {
			result = this.apply( self, arguments );
			if ( Promise.resembles( result ) ) {
				result.then(
					function () {
						args = Z.slice.call( arguments );
						emit( 'didOperation' );
						pausePending && ( running = pausePending = false );
						running && ( operation = operations[0] ) && emit( 'willContinue' );
						running && continuation.apply( operation = operations.shift(), args );
					},
					function () {
						deferral.given( args ).negate();
					}
				);
			} else {
				args = Z.slice.call( arguments );
				running && continuation.apply( next(), Z.isArray( result ) ? result : [ result ] );
			}
		} else {
			args = Z.slice.call( arguments );
			self.stop();
		}
	}
	
	function start () {
		if ( !deferral || deferral.did() ) {
			deferral = ( new Deferral ).as( self );
		}
		running = true;
		this.start = Z.getThis, this.pause = pause, this.resume = resume, this.stop = stop;
		continuation.apply( next(), args = Z.slice.call( arguments ) );
		return this;
	}
	
	function pause () {
		pausePending = true;
		this.resume = resume, this.pause = Z.getThis;
		return this;
	}
	
	function resume () {
		running = true, pausePending = false;
		this.pause = pause, this.resume = Z.getThis;
		continuation.apply( next(), args );
		return this;
	}
	
	function stop () {
		running = pausePending = false;
		this.start = start, this.pause = this.resume = this.stop = Z.getThis;
		deferral.given( args ).affirm();
		return this;
	}
	
	Z.forEach( Pipeline.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	Z.extend( this, {
		length: Z.valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		operation: function () { return operation; },
		args: function () { return Z.slice.call( args ); },
		isRunning: Z.valueFunction( function () { return running; } ),
		start: start,
		pause: Z.getThis,
		resume: Z.getThis,
		stop: Z.getThis,
		on: function ( eventType, fn ) {
			var callbacks = events[ eventType ] || ( events[ eventType ] = [] );
			return callbacks && callbacks.push( fn ) && this;
		}
	});
}
Z.extend( Pipeline, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});
