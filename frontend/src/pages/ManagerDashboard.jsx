import {
  useEffect,
  useState
} from "react";


function ManagerDashboard() {

  const emptyForm = {

    name:
      "",

    email:
      "",

    mobile:
      "",

    role:
      "student",

    hostel:
      "",

    hostelBlock:
      "",

    messUnit:
      ""

  };


  const [form, setForm] =
    useState(
      emptyForm
    );

  const [users, setUsers] =
    useState([]);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);


  const token =
    localStorage.getItem(
      "token"
    )
    ||
    sessionStorage.getItem(
      "token"
    );


  const loadUsers =
    async () => {

      try {

        const response =
          await fetch(
            "http://127.0.0.1:5000/api/manager/users",
            {

              headers: {
                Authorization:
                    `Bearer ${token}`
              }

            }
          );


        const data =
          await response.json();


        if (response.ok) {

          setUsers(
            data.users || []
          );

        }

      }

      catch {

        // Ignore initial loading failure.
      }

    };


  useEffect(() => {

    loadUsers();

  }, []);


  const handleChange =
    (event) => {

      setForm(
        (previous) => ({

          ...previous,

          [event.target.name]:
              event.target.value

        })
      );

    };


  const createUser =
    async (event) => {

      event.preventDefault();

      setError("");
      setMessage("");


      try {

        setLoading(
          true
        );


        const response =
          await fetch(
            "http://127.0.0.1:5000/api/manager/users",
            {

              method:
                "POST",

              headers: {

                "Content-Type":
                    "application/json",

                Authorization:
                    `Bearer ${token}`

              },

              body:
                JSON.stringify(
                  form
                )

            }
          );


        const data =
          await response.json();


        if (!response.ok) {

          setError(
            data.message ||
            "Unable to create account."
          );

          return;

        }


        setMessage(

          `${data.user.role === "staff"
            ? "Mess Staff"
            : "Student"
          } account created successfully. `
          +
          "Temporary password: Mess@123"

        );


        setForm(
          emptyForm
        );


        loadUsers();

      }

      catch {

        setError(
          "Unable to connect to backend."
        );

      }

      finally {

        setLoading(
          false
        );

      }

    };


  return (

    <div
      style={{
        minHeight:
          "100vh",

        background:
          "#f6f8fb",

        padding:
          "35px",

        fontFamily:
          "Inter, Segoe UI, Arial, sans-serif"
      }}
    >

      <div
        style={{
          maxWidth:
            "1200px",

          margin:
            "0 auto"
        }}
      >

        <h1
          style={{
            color:
              "#082b4c"
          }}
        >
          Manager Dashboard
        </h1>


        <p
          style={{
            color:
              "#718092"
          }}
        >
          User Management
        </p>


        {error && (

          <p
            style={{
              color:
                "#c53b3b"
            }}
          >
            {error}
          </p>

        )}


        {message && (

          <p
            style={{
              color:
                "#218340"
            }}
          >
            {message}
          </p>

        )}


        <div
          style={{
            background:
              "#fff",

            padding:
              "25px",

            marginTop:
              "25px",

            borderRadius:
              "18px",

            boxShadow:
              "0 10px 35px rgba(17,40,67,.08)"
          }}
        >

          <h2>
            Create Student / Mess Staff Account
          </h2>


          <form
            onSubmit={
              createUser
            }
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(2,minmax(0,1fr))",

              gap:
                "15px",

              marginTop:
                "20px"
            }}
          >


            <Input
              label="Full Name"
              name="name"
              value={form.name}
              onChange={handleChange}
            />


            <Input
              label="Registered Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
            />


            <Input
              label="Mobile Number"
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
            />


            <label>

              Role

              <select
                name="role"
                value={form.role}
                onChange={handleChange}
                style={inputStyle}
              >

                <option value="student">
                  Student
                </option>

                <option value="staff">
                  Mess Staff
                </option>

              </select>

            </label>


            <Input
              label="Hostel"
              name="hostel"
              value={form.hostel}
              onChange={handleChange}
            />


            <Input
              label="Hostel Block"
              name="hostelBlock"
              value={form.hostelBlock}
              onChange={handleChange}
            />


            <Input
              label="Assigned Mess"
              name="messUnit"
              value={form.messUnit}
              onChange={handleChange}
            />


            <button
              type="submit"
              disabled={loading}
              style={{
                ...inputStyle,

                alignSelf:
                  "end",

                background:
                  "#ef852b",

                color:
                  "#fff",

                border:
                  "none",

                cursor:
                  "pointer",

                fontWeight:
                  "700"
              }}
            >

              {
                loading
                  ? "Creating..."
                  : "Create Account"
              }

            </button>

          </form>

        </div>


        <div
          style={{
            background:
              "#fff",

            padding:
              "25px",

            marginTop:
              "25px",

            borderRadius:
              "18px",

            overflowX:
              "auto"
          }}
        >

          <h2>
            Students & Mess Staff
          </h2>


          <table
            style={{
              width:
                "100%",

              borderCollapse:
                "collapse",

              marginTop:
                "15px"
            }}
          >

            <thead>

              <tr>

                <Head>Name</Head>

                <Head>Email</Head>

                <Head>Role</Head>

                <Head>Hostel</Head>

                <Head>Block</Head>

                <Head>Mess</Head>

                <Head>Status</Head>

                <Head>Password</Head>

              </tr>

            </thead>


            <tbody>

              {
                users.map(
                  (user) => (

                    <tr
                      key={
                        user.id
                      }
                    >

                      <Cell>
                        {user.name}
                      </Cell>

                      <Cell>
                        {user.email}
                      </Cell>

                      <Cell>
                        {user.role}
                      </Cell>

                      <Cell>
                        {user.hostel}
                      </Cell>

                      <Cell>
                        {user.hostelBlock}
                      </Cell>

                      <Cell>
                        {user.messUnit}
                      </Cell>

                      <Cell>
                        {
                          user.isActive
                            ? "Active"
                            : "Inactive"
                        }
                      </Cell>

                      <Cell>

                        {
                          user.mustChangePassword
                            ? "Change required"
                            : "Changed"
                        }

                      </Cell>

                    </tr>

                  )
                )
              }

            </tbody>

          </table>

        </div>

      </div>

    </div>

  );

}


const inputStyle = {

  width:
    "100%",

  minHeight:
    "44px",

  padding:
    "0 12px",

  marginTop:
    "7px",

  border:
    "1px solid #d8dee6",

  borderRadius:
    "9px"

};


function Input({

  label,
  name,
  type = "text",
  value,
  onChange

}) {

  return (

    <label>

      {label}

      <input

        required

        type={
          type
        }

        name={
          name
        }

        value={
          value
        }

        onChange={
          onChange
        }

        style={
          inputStyle
        }

      />

    </label>

  );

}


function Head({
  children
}) {

  return (

    <th
      style={{
        textAlign:
          "left",

        padding:
          "12px",

        borderBottom:
          "1px solid #ddd"
      }}
    >
      {children}
    </th>

  );

}


function Cell({
  children
}) {

  return (

    <td
      style={{
        padding:
          "12px",

        borderBottom:
          "1px solid #eee"
      }}
    >
      {children}
    </td>

  );

}


export default ManagerDashboard;