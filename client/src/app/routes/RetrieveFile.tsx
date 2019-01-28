import crypto from "crypto";
import { Alert, Button, Fieldset, Form, FormButtons, Heading, Spinner, Success } from "iota-react-components";
import React, { Component, ReactNode } from "react";
import { ServiceFactory } from "../../factories/serviceFactory";
import { IConfiguration } from "../../models/config/IConfiguration";
import { ApiClient } from "../../services/apiClient";
import { ConfigurationService } from "../../services/configurationService";
import { IpfsService } from "../../services/ipfsService";
import { RetrieveFileState } from "./RetrieveFileState";

/**
 * Component which will load file data from the tangle and validate it.
 */
class RetrieveFile extends Component<any, RetrieveFileState> {
    /**
     * The configuration.
     */
    private readonly _configuration: IConfiguration;

    /**
     * The api client.
     */
    private readonly _apiClient: ApiClient;

    /**
     * The ipfs service.
     */
    private readonly _ipfsService: IpfsService;

    /**
     * Create a new instance of RetrieveFile.
     * @param props The props.
     */
    constructor(props: any) {
        super(props);

        this._configuration = ServiceFactory.get<ConfigurationService<IConfiguration>>("configuration").get();
        this._apiClient = new ApiClient(this._configuration.apiEndpoint);
        this._ipfsService = ServiceFactory.get<IpfsService>("ipfs");

        this.state = {
            isBusy: false,
            isValid: false,
            status: "",
            statusColor: "success",
            fileName: "",
            fileDescription: "",
            fileSize: undefined,
            fileModified: undefined,
            fileSha256: "",
            fileBuffer: undefined,
            transactionHash: "",
            ipfsHash: ""
        };
    }

    /**
     * Render the component.
     * @returns The node to render.
     */
    public render(): ReactNode {
        return (
            <React.Fragment>
                {!this.state.fileName && (
                    <React.Fragment>
                        <Heading level={1}>Retrieve File</Heading>
                        <p>Please enter the transaction hash of the file to retrieve from the Tangle and IPFS.</p>
                        <Form>
                            <Fieldset>
                                <label>Transaction Hash</label>
                                <input
                                    type="text"
                                    placeholder="Please enter the transaction hash in trytes"
                                    value={this.state.transactionHash}
                                    onChange={(e) => this.setState({ transactionHash: e.target.value }, () => this.validateData())}
                                />
                            </Fieldset>
                            <FormButtons>
                                <Button disabled={!this.state.isValid || this.state.isBusy} onClick={async () => this.retrieveFile()}>Retrieve</Button>
                            </FormButtons>
                            {this.state.isBusy && (
                                <React.Fragment>
                                    <FormButtons>
                                        <Spinner />
                                    </FormButtons>
                                    <FormButtons>
                                        Loading file data from the Tangle, please wait...
                                    </FormButtons>
                                </React.Fragment>
                            )}
                            {this.state.status && (
                                <React.Fragment>
                                    <FormButtons>
                                        <Alert status={this.state.status} color={this.state.statusColor} />
                                    </FormButtons>
                                </React.Fragment>
                            )}
                        </Form>
                    </React.Fragment>
                )}
                {this.state.fileName && (
                    <React.Fragment>
                        <Heading level={1}>File Validated</Heading>
                        <p>The file data has successfully been retrieved from the Tangle.</p>
                        <Form>
                            <Fieldset>
                                <label>Name</label>
                                <span>{this.state.fileName}</span>
                            </Fieldset>
                            <Fieldset>
                                <label>Description</label>
                                <span>{this.state.fileDescription}</span>
                            </Fieldset>
                            <Fieldset>
                                <label>Size</label>
                                <span>
                                    {this.state.fileSize} bytes
                                </span>
                            </Fieldset>
                            {this.state.fileModified && (
                                <Fieldset>
                                    <label>Modified Date</label>
                                    <span>{this.state.fileModified.toISOString()}</span>
                                </Fieldset>
                            )}
                            <Fieldset>
                                <label>Sha256</label>
                                <span>{this.state.fileSha256}</span>
                            </Fieldset>
                            {this.state.ipfsHash && (
                                <Fieldset>
                                    <label>IPFS Hash</label>
                                    <span>{this.state.ipfsHash}</span>
                                </Fieldset>
                            )}
                            {this.state.ipfsSha256 && (
                                <Fieldset>
                                    <label>IPFS Sha256</label>
                                    <span>{this.state.ipfsSha256}</span>
                                </Fieldset>
                            )}
                        </Form>

                        {this.state.isBusy && (
                            <React.Fragment>
                                <FormButtons>
                                    <Spinner />
                                </FormButtons>
                                <FormButtons>
                                    Validating file, please wait...
                                </FormButtons>
                            </React.Fragment>
                        )}
                        {this.state.status && (
                            <React.Fragment>
                                <FormButtons>
                                    <Alert status={this.state.status} color={this.state.statusColor} />
                                </FormButtons>
                            </React.Fragment>
                        )}
                        {this.state.fileBuffer && (
                            <React.Fragment>
                                <Success />
                                <p>The file on IPFS has been successfully validated against the data on the Tangle.</p>
                            </React.Fragment>
                        )}
                        <FormButtons>
                            <Button color="secondary" onClick={() => this.resetState()}>Retrieve Another File</Button>
                        </FormButtons>
                    </React.Fragment>
                )}
            </React.Fragment>
        );
    }

    /**
     * Validate the data in the form.
     * @returns True if the data is valid.
     */
    private validateData(): boolean {
        const isValid = /[A-Z9]{81}/.test(this.state.transactionHash) && this.state.transactionHash.length === 81;
        this.setState({ isValid, status: "" });
        return isValid;
    }

    /**
     * Validate the file using the API.
     */
    private async retrieveFile(): Promise<void> {
        this.setState({ isBusy: true, status: "" }, async () => {
            const response = await this._apiClient.retrieveFile({
                transactionHash: this.state.transactionHash || ""
            });

            if (response.success) {
                this.setState(
                    {
                        isBusy: true,
                        status: "Loading file from IPFS",
                        statusColor: "success",
                        fileName: response.name,
                        fileSize: response.size,
                        fileModified: response.modified ? new Date(response.modified) : new Date(0),
                        fileDescription: response.description,
                        fileSha256: response.sha256,
                        ipfsHash: response.ipfs
                    },
                    async () => {
                        let ipfsSha256;
                        try {
                            if (response.ipfs) {
                                const buffer = await this._ipfsService.getFile(response.ipfs);

                                if (buffer) {
                                    const sha256 = crypto.createHash("sha256");
                                    sha256.update(buffer);
                                    ipfsSha256 = sha256.digest("hex");

                                    if (ipfsSha256 === response.sha256) {
                                        this.setState({
                                            isBusy: false,
                                            status: "",
                                            statusColor: "success",
                                            fileBuffer: buffer,
                                            ipfsSha256
                                        });
                                    } else {
                                        throw new Error("The Sha256 hash of the file loaded from IPFS does not match the data stored on the Tangle");
                                    }
                                } else {
                                    throw new Error("Could not load file from IPFS");
                                }
                            } else {
                                throw new Error("IPFS hash is missing from response");
                            }
                        } catch (err) {
                            this.setState({
                                isBusy: false,
                                status: err.message,
                                statusColor: "danger",
                                ipfsSha256
                            });
                        }
                    });
            } else {
                this.setState({
                    isBusy: false,
                    status: response.message,
                    statusColor: "danger"
                });
            }
        });
    }

    /**
     * Reset the state of the component.
     */
    private resetState(): void {
        this.setState(
            {
                isBusy: false,
                isValid: false,
                status: "",
                statusColor: "success",
                fileName: "",
                fileDescription: "",
                fileSize: undefined,
                fileModified: undefined,
                fileSha256: "",
                fileBuffer: undefined,
                transactionHash: "",
                ipfsHash: ""
            },
            () => this.validateData());
    }
}

export default RetrieveFile;
