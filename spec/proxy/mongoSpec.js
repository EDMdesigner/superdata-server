const createMongoProxyCore = require("../../src/proxy/mongoCore");

let mockAsync = {
	parallel: function(array, done) {
		setTimeout(function() {
			done(null, {
				items: [],
				count: 0
			});
		}, 1);
	}
};

let mockExtend = jasmine.createSpy().and.callThrough();

let mockModel = {
	find: function() {
		return mockModel;
	},

	exec: function(callback) {
		callback(null, []);
	},

	count: function(query, callback) {
		callback(null, 0);
	},

	create: function(data, callback) {
		callback(null);
	},

	findOne: function(id, callback) {
		callback(null, {});
	},

	findOneAndUpdate: function(id, data, callback) {
		callback(null);
	},

	findOneAndRemove: function(id, callback) {
		callback(null);
	}
};

describe("Mongo proxy", function() {
	let createMongoProxy = createMongoProxyCore({
		async: mockAsync,
		extend: mockExtend
	});

	describe("with invalid config", function() {

		describe("missing model function", function() {
			it("should return an error", function() {
				expect(function() {
					createMongoProxy({});
				}).toThrowError("config.model is mandatory!");
			});
		});

	});

	describe("with valid config", function() {
		let mongoProxy;

		beforeAll(function(done) {
			spyOn(mockAsync, "parallel").and.callThrough();

			

			mongoProxy = createMongoProxy({
				model: mockModel
			});

			done();
		});
		
		it("- read should return with list of items", function(done) {
			mongoProxy.read({}, function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				expect(result.items instanceof Array).toEqual(true);
				expect(result.items).toEqual([]);
				expect(result.count).toEqual(0);
				expect(mockExtend).not.toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();
				
				done();
			});
		});

		it("- read with populate option should return with list of items", function(done) {
			let mongoProxy = createMongoProxy({
				model: mockModel,
				populate: "mockPopulate"
			});

			mongoProxy.read({}, function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				expect(result.items instanceof Array).toEqual(true);
				expect(result.items).toEqual([]);
				expect(result.count).toEqual(0);
				expect(mockExtend).not.toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();
				
				done();
			});
		});

		it("- read with filter object should return with list of items", function(done) {
			mongoProxy.read({}, {user: "User1"}, function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				expect(result.items instanceof Array).toEqual(true);
				expect(result.items).toEqual([]);
				expect(result.count).toEqual(0);
				expect(mockExtend).toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();

				done();
			});
		});

		it("- createOne should create an item", function(done) {
			mongoProxy.createOne({user: "User1"}, function(err) {
				expect(err).toBeNull();
				
				done();
			});
		});

		it("- createOne with filter object should create an item", function(done) {
			mongoProxy.createOne({user: "User1"}, {user2: "User2"}, function(err) {
				expect(err).toBeNull();
				expect(mockExtend).toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();

				done();
			});
		});

		it("- createOne should create an item", function(done) {
			mongoProxy.createOne({user: "User1"}, function(err) {
				expect(err).toBeNull();
				
				done();
			});
		});

		it("- createOne with filter object should create an item", function(done) {
			mongoProxy.createOne({user: "User1"}, {user2: "User2"}, function(err) {
				expect(err).toBeNull();
				expect(mockExtend).toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();
				
				done();
			});
		});

		it("- readOneById should return with an item object", function(done) {
			mongoProxy.readOneById("id", function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				expect(mockAsync.parallel).toHaveBeenCalled();
				
				done();
			});
		});

		it("- readOneById wit populate option should return with an item object", function(done) {
			let mongoProxy = createMongoProxy({
				model: mockModel,
				populate: "mockPopulate"
			});

			mongoProxy.readOneById("id", function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				
				done();
			});
		});

		it("- readOneById with populate should return with an item object", function(done) {
			mongoProxy.readOneById("id", function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				expect(mockAsync.parallel).toHaveBeenCalled();
				
				done();
			});
		});

		it("- readOneById with filter object should return with an item object", function(done) {
			mongoProxy.readOneById("id", {user2: "User2"}, function(err, result) {
				expect(err).toBeNull();
				expect(result).toBeDefined();
				expect(typeof result).toEqual("object");
				expect(mockExtend).toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();
				
				done();
			});
		});

		it("- updateOneById should return without error", function(done) {
			mongoProxy.updateOneById("id", "data", function(err) {
				expect(err).toBeNull();

				done();
			});
		});

		it("- updateOneById with filter object should return without error", function(done) {
			mongoProxy.updateOneById("id", "data", {user2: "User2"}, function(err) {
				expect(err).toBeNull();
				expect(mockExtend).toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();

				done();
			});
		});

		it("- destroyOneById should return without error", function(done) {
			mongoProxy.destroyOneById("id", function(err) {
				expect(err).toBeNull();

				done();
			});
		});

		it("- destroyOneById  with filter object should return without error", function(done) {
			mongoProxy.destroyOneById("id",  {user2: "User2"}, function(err) {
				expect(err).toBeNull();
				expect(mockExtend).toHaveBeenCalled();
				expect(mockAsync.parallel).toHaveBeenCalled();

				done();
			});
		});

	});

});