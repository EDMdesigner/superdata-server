"use strict";

const fs = require("fs");
const express = require("express");
const formidable = require("express-formidable");
const request = require("superagent");
const fileType = require("file-type");
const waterfall = require("async/waterfall");

const checkProxy = require("../utils/checkProxy");
const checkBelongsTo = require("../utils/checkBelongsTo");
const objectify = require("../utils/objectify");
const intify = require("../utils/intify");
const createResponseHandlerWithHooks = require("../utils/responseHandler");
const addPrehooksToParams = require("../utils/addPrehooks");


module.exports = function createGalleryRouter(config) {
	config = config || {};
	config.preHooks = config.preHooks || {};

	var router = config.router || express.Router({mergeParams: true});

	if (typeof config.createInfoObject !== "function") {
		throw new Error("config.createInfoObject must be a function");
	}

	if (typeof config.calculateBinaryId !== "function") {
		throw new Error("config.calculateBinaryId must be a function");
	}

	if (config.validMimeTypes &&
		!(typeof config.validMimeTypes === "string" ||
		config.validMimeTypes.constructor === Array))
	{
		throw new Error("config.validMimeTypes must be a string, or array");
	}

	if (!config.fileUploadProp) {
		throw new Error("config.fileUploadProp is mandatory");
	}

	if (!config.fromUrlProp) {
		throw new Error("config.fromUrlProp is mandatory");
	}

	checkBelongsTo(config.belongsTo);

	var validMimeTypes = config.validMimeTypes;

	if (validMimeTypes && typeof validMimeTypes === "string") {
		validMimeTypes = [validMimeTypes];
	}

	var createInfoObject = config.createInfoObject;
	var calculateBinaryId = config.calculateBinaryId;

	var fileUploadProp = config.fileUploadProp;
	var fromUrlProp = config.fromUrlProp;

	if (typeof config.downloadImagesFromUrl === "boolean") {
		var downloadImagesFromUrl = config.downloadImagesFromUrl;
	} else {
		var downloadImagesFromUrl = true;
	}

	router.use(formidable.parse());

	if (!config.infoProxy && !config.getInfoProxy) {
		throw new Error(
			"Neither infoProxy nor getInfoProxy function provided."
		);
	}

	if (!config.binaryProxy && !config.getBinaryProxy) {
		throw new Error(
			"Neither binaryProxy nor getBinaryProxy function provided."
		);
	}

	if (config.getInfoProxy && typeof config.getInfoProxy !== "function") {
		throw new Error(
			"The provided getInfoProxy is not a function."
		);
	}

	if (config.getBinaryProxy && typeof config.getBinaryProxy !== "function") {
		throw new Error(
			"The provided getBinaryProxy is not a function."
		);
	}

	var getInfoProxy = config.getInfoProxy || function(req, callback) {
		callback(null, config.infoProxy);
	};

	var getBinaryProxy = config.getBinaryProxy || function(req, callback) {
		callback(null, config.binaryProxy);
	};

	/*
		 ██████  ███████ ████████
		██       ██         ██
		██   ███ █████      ██
		██    ██ ██         ██
		 ██████  ███████    ██
	*/

	function get(req, res) {
		let query = req.query || {};

		query.find = objectify(query.find);
		query.sort = objectify(query.sort);

		query.skip = intify(query.skip, 0);
		query.limit = intify(query.limit, 10);


		getInfoProxy(req, function(err, infoProxy) {
			if (err) {
				return res.send({"err": err, "success": false});
			}

			checkProxy({
				proxy: infoProxy,
				msgPrefix: "infoProxy"
			});

			infoProxy.read(
				query,
				req.filter,
				createResponseHandlerWithHooks(config, req, res, "get")
			);
		});

	}

	let getParams = addPrehooksToParams(config, ["/"], "get");
	getParams.push(get);
	router.get.apply(router, getParams);


	/*
		██████   ██████  ███████ ████████
		██   ██ ██    ██ ██         ██
		██████  ██    ██ ███████    ██
		██      ██    ██      ██    ██
		██       ██████  ███████    ██
	*/

	function download(config) {
		let req = config.req;
		let res = config.res;
		let callback = config.callback;
		let url = config.url;
		let name = url.split("/");

		name = name[name.length - 1];

		request.get(url).end((err, response) => {
			if (err) {
				return res.send({"err": err, "success": false});
			}

			let data = {
				buffer: response.body,
				file: {
					name: name
				}
			};

			callback({
				req: req,
				res: res,
				data: data
			});
		});
	}

	function upload(conf) {
		var req = conf.req;
		var res = conf.res;
		var data = conf.data;

		if (validMimeTypes) {
			var ft = fileType(data.buffer);

			if (!ft || !ft.mime) {
				return res.send({
					err: "Gallery router: undefined mime type",
					success: false
				});
			}

			if (validMimeTypes.indexOf(ft.mime) === -1) {
				return res.send({
					err: "Gallery router: Invalid mime type",
					success: false
				});
			}
		}

		waterfall([
			function(callback) {
				getBinaryProxy(req, function(err, binaryProxy) {
					if (err) {
						console.log("Upload is failed! Error when getting binaryProxy: ", err);
						return callback(err);
					}

					checkProxy({
						proxy: binaryProxy,
						msgPrefix: "binaryProxy"
					});

					callback(null, binaryProxy);
				});
			},
			function(binaryProxy, callback) {
				binaryProxy.createOne(
					data.buffer,
					req.filter,
					function(err, response) {
						if (err) {
							console.log("Upload is failed! Error when creating the item in the binaryProxy: ", err);
							return callback(err);
						}

						callback(null, response);
					}
				);
			},
			function(response, callback) {
				getInfoProxy(req, function(err, infoProxy) {
					if (err) {
						console.log("Upload is failed! Error when getting infoProxy: ", err);
						return callback(err);
					}

					checkProxy({
						proxy: infoProxy,
						msgPrefix: "infoProxy"
					});

					callback(null, response, infoProxy);
				});
			}
		], function (err, response, infoProxy) {
			if (err) {
				return res.send({"err": err, "success": false});
			}
			response.file = data.file;
			createInfoObject({
				binaryResponse: response, 
				req: req,
				res: res
			},
			function(info){
				infoProxy.createOne(
					info,
					req.filter,
					createResponseHandlerWithHooks(config, req, res, "post")
				);
			});
		});
	}

	function post(req, res) {
		var contentType = req.get("Content-Type");

		if (contentType.toLowerCase().indexOf("application/json") > -1) {
			//Then it is an url

			if (req.body.downloadImagesFromUrl || downloadImagesFromUrl) {
				// if image should be downloaded
				download({
					req: req,
					res: res,
					url: req.body[fromUrlProp],
					callback: upload
				});
			} else {
				// if image should be referenced with original URL
				var url = req.body[fromUrlProp];

				createInfoObject({
					req: req,
					res: res
				},
				function(info){
					getInfoProxy(req, function(err, infoProxy) {
						if (err) {
							return res.send({"err": err, "success": false});
						}
	
						checkProxy({
							proxy: infoProxy,
							msgPrefix: "infoProxy"
						});
	
						infoProxy.createOne(
							info,
							req.filter,
							createResponseHandlerWithHooks(config, req, res, "post")
						);
					});
				});
			}
		} else {
			// Then it is a file
			fs.readFile(req.body[fileUploadProp].path, function(err, buffer) {
				var data = {
					file: req.body.file,
					buffer: buffer
				};

				// note: posthooks are handled in this function
				upload({
					req: req,
					res: res,
					data: data
				});
			});
		}
	}

	let postParams = addPrehooksToParams(config, ["/"], "post");
	postParams.push(post);
	router.post.apply(router, postParams);


	/*
		 ██████  ███████ ████████  ██████  ███    ██ ███████
		██       ██         ██    ██    ██ ████   ██ ██
		██   ███ █████      ██    ██    ██ ██ ██  ██ █████
		██    ██ ██         ██    ██    ██ ██  ██ ██ ██
		 ██████  ███████    ██     ██████  ██   ████ ███████
	*/

	function getOne(req, res) {
		let id = req.params.id;

		// avoid accidentally apply id to the filter from preHooks
		if (req.filter && req.filter.id) {
			delete req.filter.id;
		}

		getInfoProxy(req, function(err, infoProxy) {
			if (err) {
				return res.send({"err": err, "success": false});
			}

			checkProxy({
				proxy: infoProxy,
				msgPrefix: "infoProxy"
			});

			infoProxy.readOneById(
				id,
				req.filter,
				createResponseHandlerWithHooks(config, req, res, "getOne")
			);
		});
	}

	let getOneParams = addPrehooksToParams(config, ["/:id"], "getOne");
	getOneParams.push(getOne);
	router.get.apply(router, getOneParams);


	/*
		██████  ██    ██ ████████
		██   ██ ██    ██    ██
		██████  ██    ██    ██
		██      ██    ██    ██
		██       ██████     ██
	*/

	function put(req, res) {
		var id = req.params.id;
		var data = req.body;

		// avoid accidentally apply id to the filter from preHooks
		if (req.filter && req.filter.id) {
			delete req.filter.id;
		}

		getInfoProxy(req, function(err, infoProxy) {
			if (err) {
				return res.send({"err": err, "success": false});
			}

			checkProxy({
				proxy: infoProxy,
				msgPrefix: "infoProxy"
			});

			infoProxy.updateOneById(
				id,
				data,
				req.filter,
				createResponseHandlerWithHooks(config, req, res, "put")
			);
		});
	}

	let putParams = addPrehooksToParams(config, ["/:id"], "put");
	putParams.push(put);
	router.put.apply(router, putParams);


	/*
		PATCH
	*/

	function patch(req, res) {
		var id = req.params.id;
		var data = req.body;

		// avoid accidentally apply id to the filter from preHooks
		if (req.filter && req.filter.id) {
			delete req.filter.id;
		}

		getInfoProxy(req, function(err, infoProxy) {
			if (err) {
				return res.send({"err": err, "success": false});
			}

			checkProxy({
				proxy: infoProxy,
				msgPrefix: "infoProxy"
			});

			infoProxy.patchOneById(
				id,
				data,
				req.filter,
				createResponseHandlerWithHooks(config, req, res, "patch")
			);
		});
	}

	let patchParams = addPrehooksToParams(config, ["/:id"], "patch");
	patchParams.push(patch);
	router.patch.apply(router, patchParams);

	/*
		██████  ███████ ██      ███████ ████████ ███████
		██   ██ ██      ██      ██         ██    ██
		██   ██ █████   ██      █████      ██    █████
		██   ██ ██      ██      ██         ██    ██
		██████  ███████ ███████ ███████    ██    ███████
	*/

	function del(req, res) {
		let id = req.params.id;

		// avoid accidentally apply id to the filter from preHooks
		if (req.filter && req.filter.id) {
			delete req.filter.id;
		}

		waterfall([
			function(callback) {
				getInfoProxy(req, function(err, infoProxy) {
					if (err) {
						return callback(err);
					}

					checkProxy({
						proxy: infoProxy,
						msgPrefix: "infoProxy"
					});

					callback(null, infoProxy);
				});
			},
			function(infoProxy, callback) {
				infoProxy.destroyOneById(id, req.filter, function(err, result) {
					if (err) {
						return callback(err);
					}

					if (!result) {
						return callback("Item does not exist.");
					}

					let binId = calculateBinaryId(result);

					callback(null, binId);
				});
			},
			function(binId, callback) {
				getBinaryProxy(req, function(err, binaryProxy) {
					if (err) {
						return callback(err);
					}

					checkProxy({
						proxy: binaryProxy,
						msgPrefix: "binaryProxy"
					});

					callback(null, binId, binaryProxy);
				});
			}
		], function (err, binId, binaryProxy) {
			if (err) {
				return res.send({"err": err, "success": false});
			}

			binaryProxy.destroyOneById(
				binId,
				req.filter,
				createResponseHandlerWithHooks(config, req, res, "delete")
			);
		});
	}

	let deleteParams = addPrehooksToParams(config, ["/:id"], "delete");
	deleteParams.push(del);
	router.delete.apply(router, deleteParams);


	return router;
};
