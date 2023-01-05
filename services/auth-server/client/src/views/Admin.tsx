import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { fetcher } from "@orchest/lib-utils";
import React from "react";
import { CenteredStack } from "./CenteredStack";

type User = { username: string };

const UserList: React.FC<{
  data: User[];
  onDelete: (userName: string) => void;
  onFailedToDelete: (error: string) => void;
}> = ({ data, onDelete, onFailedToDelete }) => {
  const deleteUser = async (username: string) => {
    // auto save the bash script
    let formData = new FormData();
    formData.append("username", username);

    try {
      await fetcher("/login/users", {
        method: "DELETE",
        body: formData,
      });
      onDelete(username);
    } catch (error) {
      onFailedToDelete(error.error);
    }
  };

  return (
    <Box sx={{ marginTop: 6, marginBottom: 4 }}>
      <Typography variant="h6">Delete users</Typography>
      <Stack direction="column" sx={{ marginTop: 2 }}>
        {data.map((user) => {
          return (
            <Box key={user.username}>
              <Box component="span" sx={{ marginRight: 2 }}>
                {user.username}
              </Box>
              <Button
                color="secondary"
                onClick={() => deleteUser(user.username)}
                data-test-id={`delete-user-${user.username}`}
              >
                Delete
              </Button>
            </Box>
          );
        })}
        {data.length === 0 && <i>There are no users yet.</i>}
      </Stack>
    </Box>
  );
};

const Admin = () => {
  const [users, setUsers] = React.useState<User[]>([]);
  const [newUsername, setNewUsername] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [formError, setFormError] = React.useState<string>();

  const fetchUsers = async () => {
    try {
      const response = await fetcher<{ users: User[] }>("/login/users");
      setUsers(response.users);
    } catch (error) {
      console.log(error.body.error);
    }
  };

  React.useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async () => {
    // auto save the bash script
    let formData = new FormData();
    // TODO: proper client-side form validation
    formData.append("username", newUsername);
    formData.append("password", newPassword);

    setNewUsername("");
    setNewPassword("");
    setFormError(undefined);

    try {
      await fetcher("/login/users", {
        method: "POST",
        body: formData,
      });
      fetchUsers();
    } catch (errorResponse) {
      console.log(errorResponse);
      setFormError(errorResponse.error);
    }
  };

  const onDelete = (deletedUser: string) => {
    setUsers((currentUsers) => {
      return currentUsers.filter((user) => user.username !== deletedUser);
    });
  };
  const userNameValidation = users.some(
    (user) => user.username.toLowerCase() === newUsername.trim().toLowerCase()
  )
    ? "Username already taken."
    : " ";

  const isValid = userNameValidation === " " && newPassword.length > 0;

  return (
    <CenteredStack>
      <Box>
        <Typography variant="h6" sx={{ marginBottom: 4 }}>
          Add a user
        </Typography>
        <Stack direction="column" alignItems="flex-start" spacing={1}>
          <TextField
            autoFocus
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            label="Username"
            name="username"
            data-test-id="new-user-name"
            error={userNameValidation !== " "}
            helperText={userNameValidation}
          />
          <TextField
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            label="Password"
            type="password"
            name="password"
            helperText=" "
            data-test-id="new-user-password"
          />
          <Button
            onClick={addUser}
            color="secondary"
            variant="contained"
            sx={{ marginTop: 2 }}
            disabled={!isValid}
            data-test-id="add-user"
          >
            Add
          </Button>
        </Stack>
        {formError && (
          <Typography sx={{ marginTop: 4, color: "error.main" }}>
            {formError}
          </Typography>
        )}
        <UserList
          data={users}
          onDelete={onDelete}
          onFailedToDelete={setFormError}
        />
      </Box>
    </CenteredStack>
  );
};

export default Admin;
