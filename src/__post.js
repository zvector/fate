extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	// Operation: Operation,
	OperationQueue: OperationQueue,
	when: when
});

})( typeof module === 'undefined' ? { exports: {} } : module );
