import { firstNameOf } from "./first-name";

describe("firstNameOf", () => {
  it("TK-02.02: takes the first word of the name", () => {
    expect(firstNameOf("Beatriz Lima")).toBe("Beatriz");
  });

  it("TK-02.02: ignores extra spaces around and between words", () => {
    expect(firstNameOf(" Ana  Souza ")).toBe("Ana");
  });

  it("TK-02.02: keeps a single-word name as it is", () => {
    expect(firstNameOf("Marina")).toBe("Marina");
  });

  it("TK-02.02: takes only the first part of a compound name", () => {
    expect(firstNameOf("Maria Clara Fernandes")).toBe("Maria");
  });

  it("TK-02.02: ignores tabs and line breaks between words", () => {
    expect(firstNameOf("\tJoão\nPedro")).toBe("João");
  });
});
