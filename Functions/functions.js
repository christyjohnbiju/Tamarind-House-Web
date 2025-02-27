import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "../firebase/config";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import emailjs from "@emailjs/browser";


// Generates OTP for both login and signup
const generateOTP = () => {
  let randomNumber = "";
  for (let i = 0; i < 4; i++) {
    randomNumber += Math.floor(Math.random() * 10);
  }
  return randomNumber;
};

// checks whether the student is a hosteler or not and sends the otp for verification
export const handleSignup = async (
  studentID,
  username,
  email,
  form
) => {
  let status = {
    success: false,
    otp: null,
    notValid: false,
    notValidEmail: false,
    err: null,
  };
  try {
    const docRef = doc(db, "users", email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const existingId = docSnap.data().id;
      console.log(docSnap.data().email);
      if (existingId === studentID) {
        const send = await sendEmail(form);
        if (send.success) {
          await setDoc(doc(db, "users", email), {
            name: username,
            id: studentID,
            email: email,
            dateOfReg: new Date(),
          });
          status.otp = send.otp;
          status.success = true;
        } else {
          status.err = send.error;
        }
      } else {
        status.notValid = true;
      }
    } else {
      status.notValidEmail = true;
      console.log("No such document!");
    }
  } catch (e) {
    status.err = e.message;
    console.log(e.message);
  }
  return status;
};

// Invokes when the otp matches and creates account
export const Signup = async (email, password) => {
  const status = {
    success: false,
    err: null,
  };
  try {
    await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );
    const washingtonRef = doc(db, "users", email);
    await updateDoc(washingtonRef, {
      dateOfReg: new Date(),
    });
    status.success = true;
  } catch (error) {
    status.err = error;
    alert(error.message);
  }
  console.log("Student Enrolled succesfully !!");
  return status;
};

// check whether the student exist and sends otp for verification
export const handleLogin = async (email, form) => {
  console.log(form);
  const status = {
    success: false,
    otp: null,
    err: null,
    notValid: false,
  };
  try {
    const docRef = doc(db, "users", email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const send = await sendEmail(form);
      if (send.success) {
        status.otp = send.otp;
        status.success = true;
      }
    } else {
      status.notValid = true;
    }
  } catch (error) {
    console.log(error);
    status.err = error.message;
  }
  return status;
};

// Invokes when the otp matches and login the user
export const Login = async (email, password) => {
  const status = {
    success: false,
    err: null,
  };
  try {
    await signInWithEmailAndPassword(
      auth,
      email,
      password
    );
    status.success = true;
  } catch (error) {
    status.err = error.message;
    console.log(error.message);
  }
  return status;
};

// Sends otp to the student via email
const sendEmail = async (form) => {
  let status = {
    success: false,
    otp: null,
    error: null,
  };
  const otp = generateOTP();
  form.otp.value = otp;

  await emailjs
    .sendForm("service_vwwafuc", "template_ujysduq", form, {
      publicKey: "OWoHGZ94EI8Pn8jAU",
    })
    .then(
      () => {
        console.log("SUCCESS!");
        console.log("Your OTP:", otp);
        status.success = true;
        status.otp = otp;
      },
      (error) => {
        console.log("FAILED...", error.text);
        status.error = error;
      }
    );
  return status;
};

// Check whether the user have already generated token on that particular day
export const checkTokenExistence = async (email) => {
  let status = {
    data: null,
    tokenExist: false,
    token: null,
    time: null,
    err: null,
  };
  try {
    const studentData = await getData(email);
    const currentDate = new Date();

    let timeChange = true;
    if (studentData.tokenTime) {
      timeChange = isDateGreaterThan(
        convertTime(studentData.tokenTime),
        currentDate
      );
    }
    if (timeChange) {
      status.data = studentData;
      console.log(
        "generatedTime: ",
        studentData.tokenTime + " Current: ",
        currentDate
      );
    } else {
      const newTime = convertTime(studentData.tokenTime);
      status.tokenExist = true;
      status.token = studentData.token;
      status.time = getTimeFromDate(newTime);
    }
  } catch (e) {
    console.log(e);
    status.err = e.message;
  }
  return status;
};

// Generates token for the user 
export const generateToken = async (email) => {
  let studentData;
  let status = {
    success: false,
    tokenExist: false,
    token: null,
    time: null,
    err: null,
  };

  // const checkToken = await checkTokenExistence(email);

  // if (checkToken.data) {

    try {
      // temporary 
      const studentData = await getData(email);
      // studentData = checkToken.data;
      const tokenNumber = Math.floor(100000 + Math.random() * 900000);
      console.log(tokenNumber);

      const tokenDocRef = doc(db, "tokens", tokenNumber.toString());
      const docSnap = await getDoc(tokenDocRef);

      if (docSnap.exists()) {
        generateToken(email);
        console.log("Document already exists");
      } else {
        const date = new Date();
        const time = getTimeFromDate(date);
        const batch = writeBatch(db);

        batch.set(tokenDocRef, {
          name: studentData.name,
          id: studentData.id,
          generationTime: time,
          isCollected: false,
          date: formatDate(date),
        });

        const studentRef = doc(db, "users", email);
        batch.update(studentRef, {
          token: tokenNumber,
          tokenTime: date,
        });
        await batch.commit();
        status.success = true;
        status.token = tokenNumber;
        status.time = time;
      }
    } catch (err) {
      status.err = err.message;
      console.log(err.message);
    }
  // } else {
  //   status.tokenExist = true;
  //   status.token = checkToken.token;
  //   status.time = checkToken.tokenTime;
  // }
  return status;
};

// Gets the token generation history of that particular student
export const getStudentTokenHistory = async (email) => {
  const userData = await getData(email);
  let data;
  let studentHistory =  [];
  try {
    const docRef = doc(db, "user-history", userData.id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      data = docSnap.data();
      console.log(data);
    } else {
      console.log("No such document!");
    }
    Object.entries(data).forEach(([key, value]) => {
        studentHistory.push({key,value})
    });
    return studentHistory;
  } catch (err) {
    console.log(err.message);
  }
};

// Gets the data of the Student
export const getData = async (email) => {
  try {
    const docRef = doc(db, "users", email);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = {
        id: docSnap.data().id,
        name: docSnap.data().name,
        dateOfReg: docSnap.data().dateOfReg,
        token: docSnap.data().token,
        tokenTime: docSnap.data().tokenTime,
      };
      return data;
    } else {
      return null;
    }
  } catch (err) {
    alert(err.message);
  }
};

// converts the date from firebase to normal format
export const convertTime = (time) => {
  const milliseconds = time.seconds * 1000 + time.nanoseconds / 1e6;
  time = new Date(milliseconds);
  time = time.toString();
  return time;
};

// Gets the time from the js date object
export const getTimeFromDate = (date) => {
  console.log("New Date:1 ", date);
  const newDate = new Date(date);
  console.log("New Date:2 ", newDate);
  const hours = newDate.getHours();
  const minutes = newDate.getMinutes();

  const formattedHours = hours % 12 === 0 ? 12 : hours % 12;

  const period = hours < 12 ? "AM" : "PM";

  const formattedMinutes = minutes < 10 ? "0" + minutes : minutes;

  return `${formattedHours}:${formattedMinutes} ${period}`;
};

// checks if both dates are on the same day
function isDateGreaterThan(date1, date2) {
  var d1 = new Date(date1);
  var d2 = new Date(date2);
  console.log("Dates: ", d1, d2);

  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  return d1.getTime() < d2.getTime();
}

// Generate the date from the js date object
export const formatDate = (date) => {

  var day = date.getDate();
  var month = date.getMonth() + 1;
  var year = date.getFullYear();

  if (day < 10) {
    day = "0" + day;
  }
  if (month < 10) {
    month = "0" + month;
  }
  return day + "-" + month + "-" + year;
};
