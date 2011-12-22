/**
 * A **multiplex** employs a specific number of concurrent pipelines to process an array of operations in
 * parallel. Its `width`, which is the maximum number of pipelines that are allowed to operate concurrently,
 * can be adjusted dynamically as the multiplex is running; this will cause pipelines to be automatically
 * added as necessary, or removed as necessary once their current operations complete.
 */
function Multiplex ( width, operations ) {
	if ( !( this instanceof Multiplex ) ) {
		return new Multiplex( width, operations );
	}
	if ( arguments.length === 1 ) {
		operations = width, width = operations.length;
	}
	
	var	self = this,
		deferral = ( new Deferral ).as( self ),
		args,
		running = false,
		pipeCount = 0,
		first, last;
	
	function returnSelf () {
		return self;
	}
	
	function fill () {
		while ( pipeCount < width && operations.length ) {
			addPipe();
		}
	}
	
	function addPipe () {
		var pipe = Pipeline( operations )
			.on( 'didContinue', didContinue )
			.on( 'willContinue', willContinue )
		;
		last = last ? ( ( pipe.previous = last ).next = pipe ) : ( first = pipe );
		pipe.promise().always( function () {
			removePipe( pipe );
		});
		running && pipe.start.apply( pipe, args );
		pipeCount++;
		return pipe;
	}
	
	function removePipe ( pipe ) {
		var previous = pipe.previous, next = pipe.next;
		previous && ( previous.next = next ), next && ( next.previous = previous );
		previous || next || self.stop();
		return pipe;
	}
	
	function didContinue ( event ) {
		args = event.args;
	}
	
	function willContinue ( event ) {
		var pipe = event.pipeline;
		if ( pipeCount > width ) {
			pipeCount--;
			pipe.stop();
		} else if ( pipeCount < width ) {
			// because operations may have been added
			fill();
		}
	}
	
	function as ( context ) {
		deferral.as( context );
		return self;
	}
	
	function given ( args_ ) {
		deferral.given( args = args_ );
		return self;
	}
	
	function start () {
		arguments.length && ( args = Z.slice.call( arguments ) );
		running = true;
		self.as = self.given = self.start = returnSelf, self.stop = stop, self.abort = abort;
		fill();
		return self;
	}
	
	function stop () {
		running = false;
		self.start = start, self.as = as, self.given = given, self.stop = self.abort = returnSelf;
		deferral.given( args ).affirm();
		return self;
	}
	
	function abort () {
		running = false;
		self.start = start, self.as = as, self.given = given, self.stop = self.abort = returnSelf;
		deferral.given( args ).negate();
		return self;
	}
	
	Z.forEach( Multiplex.arrayMethods, function ( method ) {
		self[ method ] = function () {
			return Array.prototype[ method ].apply( operations, arguments );
		};
	});
	
	Z.extend( this, {
		length: Z.valueFunction( function () { return operations.length; } ),
		promise: function () { return deferral.promise(); },
		width: function ( value ) {
			if ( Z.isNumber( value = +value ) ) {
				width = value;
				fill();
			}
			return width;
		},
		isRunning: Z.valueFunction( function () { return running; } ),
		as: as,
		given: given,
		start: start,
		stop: returnSelf
	});
}
Z.extend( Multiplex, {
	arrayMethods: 'push pop shift unshift reverse splice'.split(' ')
});
Z.extend( Multiplex.prototype, {
	dilate: function ( amount ) {
		Z.isNumber( amount = +amount ) || ( amount = 1 );
		return this.width( this.width() + amount );
	},
	constrict: function ( amount ) {
		Z.isNumber( amount = +amount ) || ( amount = 1 );
		return this.width( this.width() - amount );
	}
})