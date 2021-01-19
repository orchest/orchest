import React from "react";
import MDCButtonReact from "../lib/mdc-components/MDCButtonReact";
import MDCSelectReact from "../lib/mdc-components/MDCSelectReact";
import MDCTextFieldReact from "../lib/mdc-components/MDCTextFieldReact";
import { makeRequest } from "../lib/utils/all";
import DataSourcesView from "./DataSourcesView";

class DataSourceEditView extends React.Component {
  componentWillUnmount() {}

  onSelectDataSourceType(value) {
    this.setState({
      dynamicForm: value,
    });
  }

  onChangeName(value) {
    this.state.dataSource.name = value;

    this.setState({
      dataSource: this.state.dataSource,
    });
  }

  constructor(props) {
    super(props);

    this.state = {
      originalName: this.props.dataSource
        ? this.props.dataSource.name
        : undefined,
      newDataSource: this.props.dataSource === undefined,
      dataSource: this.props.dataSource
        ? this.props.dataSource
        : {
            name: "",
            source_type: "",
            connection_details: {},
          },
      dynamicForm: this.props.dataSource
        ? this.props.dataSource.source_type
        : undefined,
      formData: {
        "host-directory": {
          groups: [
            {
              name: "Directory details",
              fields: [
                {
                  label: "Absolute host path",
                  name: "absolute_host_path",
                  type: "textfield",
                },
              ],
            },
          ],
        },
        "database-mysql": {
          groups: [
            {
              name: "Connection details",
              fields: [
                {
                  label: "Host",
                  name: "host",
                  type: "textfield",
                },
                {
                  label: "Database name",
                  name: "database_name",
                  type: "textfield",
                },
                {
                  label: "Username",
                  name: "username",
                  type: "textfield",
                },
                {
                  label: "Password",
                  name: "password",
                  type: "password",
                },
              ],
            },
          ],
        },
        "database-postgresql": {
          groups: [
            {
              name: "Connection details",
              fields: [
                {
                  label: "Host",
                  name: "host",
                  type: "textfield",
                },
                {
                  label: "Database name",
                  name: "database_name",
                  type: "textfield",
                },
                {
                  label: "Username",
                  name: "username",
                  type: "textfield",
                },
                {
                  label: "Password",
                  name: "password",
                  type: "password",
                },
              ],
            },
          ],
        },
        "database-aws-redshift": {
          groups: [
            {
              name: "Connection details",
              fields: [
                {
                  label: "Host",
                  name: "host",
                  type: "textfield",
                },
                {
                  label: "Database name",
                  name: "database_name",
                  type: "textfield",
                },
                {
                  label: "Username",
                  name: "username",
                  type: "textfield",
                },
                {
                  label: "Password",
                  name: "password",
                  type: "password",
                },
              ],
            },
          ],
        },
        "objectstorage-aws-s3": {
          groups: [
            {
              name: "Connection details",
              fields: [
                {
                  label: "AWS Bucket name",
                  name: "bucket",
                  type: "textfield",
                },
                {
                  label: "Access key",
                  name: "access_key",
                  type: "textfield",
                },
                {
                  label: "Secret key",
                  name: "secret_key",
                  type: "password",
                },
              ],
            },
          ],
        },
      },
    };
  }

  // TODO: work form generation into component separate from DataSourceEditView
  generateField(field) {
    let elements = [];

    let prefill = undefined;

    try {
      prefill = this.state.dataSource.connection_details[field.name];
    } catch (e) {
      console.log(e);
    }

    switch (field.type) {
      case "textfield":
        elements.push(
          <MDCTextFieldReact
            maxLength={255}
            key={field.name}
            value={prefill}
            classNames={["push-down"]}
            label={field.label}
            onChange={this.changeValue.bind(this, field.name)}
          />
        );
        break;
      case "password":
        elements.push(
          <MDCTextFieldReact
            maxLength={255}
            value={prefill}
            key={field.name}
            classNames={["push-down"]}
            inputType="password"
            label={field.label}
            onChange={this.changeValue.bind(this, field.name)}
          />
        );
        break;
      case "select":
        elements.push(
          <MDCSelectReact
            value={prefill}
            classNames={["push-down"]}
            label={field.label}
            options={field.options}
            onChange={this.changeValue.bind(this, field.name)}
          />
        );
        break;
    }

    return elements;
  }

  generateGroup(group) {
    let elements = [];

    for (let x = 0; x < group.fields.length; x++) {
      let field = group.fields[x];
      elements = elements.concat(this.generateField(field));
    }

    return elements;
  }

  generateDynamicForm(formData) {
    let elements = [];

    for (let x = 0; x < formData.groups.length; x++) {
      let group = formData.groups[x];

      elements.push(
        <h2 key={x} className="push-down">
          {group.name}
        </h2>
      );
      elements = elements.concat(this.generateGroup(group));
    }

    return elements;
  }

  changeValue(key, value) {
    this.state.dataSource.connection_details[key] = value;

    this.setState({
      dataSource: this.state.dataSource,
    });
  }

  getConnectionDetails() {
    let groups = this.state.formData[this.state.dynamicForm].groups;

    // JSON object to pass to database
    let connection_details = {};

    for (let x = 0; x < groups.length; x++) {
      let fields = groups[x].fields;

      for (let i = 0; i < fields.length; i++) {
        let field = fields[i];

        connection_details[field.name] = this.state.dataSource
          .connection_details[field.name]
          ? this.state.dataSource.connection_details[field.name]
          : "";
      }
    }

    return connection_details;
  }

  saveDataSource(e) {
    e.preventDefault();

    // form validation
    if (this.state.dataSource.name.length < 1) {
      orchest.alert("Error", "Please fill in a data source name.");
      return;
    }

    if (this.state.dynamicForm === undefined) {
      orchest.alert("Error", "Please choose a data source type.");
      return;
    }

    // make request to backend to save data
    let method = "POST";
    let endpointName = this.state.dataSource.name;

    if (this.state.newDataSource === false) {
      method = "PUT";
      endpointName = this.state.originalName;
    }

    makeRequest(method, "/store/datasources/" + endpointName, {
      type: "json",
      content: {
        name: this.state.dataSource.name,
        source_type: this.state.dynamicForm,
        connection_details: this.getConnectionDetails(),
      },
    })
      .then(() => {
        orchest.loadView(DataSourcesView);
      })
      .catch((error) => {
        console.log(error);

        try {
          console.error(JSON.parse(error.body)["message"]);
        } catch (error) {
          console.log(error);
          console.log("Couldn't get error message from response.");
        }
      });
  }

  render() {
    let dynamicFormElements = undefined;

    if (
      this.state.dynamicForm !== undefined &&
      this.state.dynamicForm.length > 0
    ) {
      dynamicFormElements = this.generateDynamicForm(
        this.state.formData[this.state.dynamicForm]
      );
    }

    return (
      <div className={"view-page"}>
        <h2>Edit data source</h2>

        <form
          className="connection-form"
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <MDCTextFieldReact
            classNames={["push-down"]}
            label="Name"
            maxLength={255}
            value={this.state.dataSource["name"]}
            onChange={this.onChangeName.bind(this)}
          />

          <MDCSelectReact
            onChange={this.onSelectDataSourceType.bind(this)}
            classNames={["push-down"]}
            label="Data source type"
            value={this.state.dynamicForm}
            options={[
              ["host-directory", "Filesystem directory"],
              ["database-mysql", "MySQL"],
              ["database-postgresql", "PostgreSQL"],
              ["database-aws-redshift", "AWS Redshift"],
              ["objectstorage-aws-s3", "AWS S3"],
            ]}
          />

          {dynamicFormElements}

          <MDCButtonReact
            classNames={["mdc-button--raised"]}
            onClick={this.saveDataSource.bind(this)}
            label="Save"
            icon="save"
          />
        </form>
      </div>
    );
  }
}

export default DataSourceEditView;
