const request = require("supertest");

jest.mock("../utils/mailSender", () => jest.fn().mockResolvedValue({ messageId: "mock_mail_id" }));

const mailSender = require("../utils/mailSender");
const app = require("../index");

describe("Contact Endpoint (server/controllers/ContactUs.js)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if email or message is missing", async () => {
    const res = await request(app)
      .post("/api/v1/reach/contact")
      .send({ firstname: "John" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Email and message are required/i);
  });

  it("should send confirmation email and return 200 on valid message", async () => {
    const res = await request(app)
      .post("/api/v1/reach/contact")
      .send({
        email: "user@test.com",
        firstname: "John",
        lastname: "Doe",
        message: "Hello StudyNotion!",
        phoneNo: "1234567890",
        countrycode: "+91",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mailSender).toHaveBeenCalled();
  });
});
