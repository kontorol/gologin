const generator = require("generate-password");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const cheerio = require("cheerio");
const fs = require("fs");
const {faker} = require('@faker-js/faker');


async function fakeNameGenerator() {
    const url = "https://www.fakenamegenerator.com/advanced.php?t=country&n%5B%5D=us&c%5B%5D=us&gen=50&age-min=19&age-max=51";
    const array = [];

    const row = {};
    const response = await fetch(url);
    const html = await response.text();
    // console.log(html);
    const $ = cheerio.load(html);
    const infoSection = $("div.address", html);

    row.name = infoSection.first().find("h3").first().text();
    const nameLenght = row.name.trim().split(/\s+/)
    if (nameLenght.length === 3) {
        row.fname = nameLenght[0];
        row.mname = nameLenght[1];
        row.lname = nameLenght[2];
    } else if (nameLenght.length === 2) {
        row.fname = nameLenght[0];
        row.mname = "";
        row.lname = nameLenght[1];
    }
    row.fakeAddress = infoSection.first().find("div.adr").first().text().replace("\n", "").trim();
    const dls = $("dl.dl-horizontal");

    dls.each(function () {
        var el = $(this);
        // console.log(el.text());
        const head = el.find("dt").first();
        const headText = head.text().toLowerCase();
        // console.log("head", headText);
        if (headText.includes("email")) {
            row.recoveryEmail = el.find("dd").first().text().split(" ")[0];
            //row.workFakeEmail = el.find("div.adtl").find("a").first().attr("href");
        }
        if (headText.includes("vehicle")) {
            row.vehicle = el.find("dd").first().text();
        }
        if (headText.includes("favorite color")) {
            row.favoriteColor = el.find("dd").first().text();
        }
        if (headText.includes("birthday")) {
            row.birthday = el.find("dd").first().text();
        }
        // if (headText.includes("age")) {
        //     row.age = el.find("dd").first().text();
        // }
        if (headText.includes("phone")) {
            row.phone = el.find("dd").first().text();
        }
        if (headText.includes(" maiden name")) {
            row.maidenName = el.find("dd").first().text();
        }
        row.password = generator.generate({
            length: 10,
            numbers: true,
        });
        row.gmail =
            `${row.recoveryEmail}`.split("@")[0] +
            generator.generate({
                length: 4,
                numbers: true,
            }) +
            "@gmail.com";
        row.gmail = row.gmail.toLowerCase();
        row.recoveryEmail = `${row.recoveryEmail}`.toLowerCase();
    });

    // console.log(row, dls.length);

    return row
}

async function fakerNameGenerator(length) {
    // const USERS = [];
    return {
        username: faker.internet.userName(),
        email: faker.internet.email(),
        avatar: faker.image.avatar(),
        password: faker.internet.password(),
        birthdate: faker.date.birthdate(),
        registeredAt: faker.date.past(),
    };
    // Array.from({ length: 10 }).forEach(() => {
    //     USERS.push(createRandomUser());
    // });
}