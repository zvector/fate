// TODO export as string (`global['...']`) for Closure Compiler
extend( typeof module === 'undefined' ? global : module.exports, {
	Deferral: Deferral,
	Promise: Promise,
	Pipeline: Pipeline,
	Multiplex: Multiplex,
	Procedure: Procedure
});

})();
