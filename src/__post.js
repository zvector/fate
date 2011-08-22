extend( global, module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	Pipeline: Pipeline,
	Multiplex: Multiplex,
	Procedure: Procedure
});

})( typeof module === 'undefined' ? { exports: {} } : module );
